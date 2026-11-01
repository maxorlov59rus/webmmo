// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — игровой сервер (Node.js)
//  Связка: Express (HTTP API + статика клиента) + ws (WebSocket
//  для MMO-слоя) + MySQL (аккаунты, персонажи, чат, сессии).
//
//  Запуск:
//    node server/server.js
//  Переменные окружения:
//    PORT=3000  DB_HOST=127.0.0.1  DB_PORT=3306  DB_USER=root
//    DB_PASS=   DB_NAME=nvr_game   DB_AUTOINIT=1 (создать БД/таблицы)
//    NO_DB=1    — запуск без MySQL (в памяти; для быстрой проверки)
//
//  Клиент подключается так:
//    http://localhost:3000/?api=http://localhost:3000&server=ws://localhost:3000/ws
// ============================================================
'use strict';

const path = require('path');
require('./env');                            // загружаем server/.env до остального
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const ROOT = path.join(__dirname, '..');           // корень проекта (клиент)
const PORT = parseInt(process.env.PORT || '3000', 10);
const NO_DB = process.env.NO_DB === '1';

// ----------------------- конфигурация рейтов/лимитов ----------------------
const CFG = {
  WS_PATH:        process.env.WS_PATH || '/ws',
  TICK_MS:        Math.max(16, parseInt(process.env.TICK_MS || '50', 10)),
  MOVE_RATE_HZ:   Math.max(1, parseInt(process.env.MOVE_RATE_HZ || '15', 10)),
  CHAT_RATE_PER_S:Math.max(0, parseInt(process.env.CHAT_RATE_PER_S || '2', 10)),
  MAX_PLAYERS_WS: Math.max(1, parseInt(process.env.MAX_PLAYERS_WS || '200', 10)),
  HEARTBEAT_MS:   Math.max(5000, parseInt(process.env.HEARTBEAT_MS || '30000', 10)),
  IDLE_TIMEOUT_MS:Math.max(10000, parseInt(process.env.IDLE_TIMEOUT_MS || '90000', 10)),
  SAVE_EVERY_S:   Math.max(5, parseInt(process.env.SAVE_EVERY_S || '30', 10)),
  // --- настройки чат-систем (переопределяются таблицей chat_settings из БД) ---
  CHAT_GLOBAL_ON: process.env.CHAT_GLOBAL_ON !== '0',
  CHAT_LOCAL_ON:  process.env.CHAT_LOCAL_ON  !== '0',
  CHAT_PARTY_ON:  process.env.CHAT_PARTY_ON  !== '0',
  CHAT_WHISPER_ON:process.env.CHAT_WHISPER_ON!== '0',
  CHAT_SYSTEM_ON: process.env.CHAT_SYSTEM_ON !== '0',
  CHAT_GM_ON:     process.env.CHAT_GM_ON     !== '0',
  WHISPER_RATE:   Math.max(0, parseInt(process.env.WHISPER_RATE_PER_S || '4', 10)),
  SYS_JOIN_LEAVE: process.env.SYS_JOIN_LEAVE !== '0',
  SYS_MAX_LEN:    Math.max(60, parseInt(process.env.SYS_MAX_LEN || '200', 10)),
  PUBLIC_MODE:    process.env.PUBLIC_MODE === '1',
  // --- ИНСТАНСЫ: настройки, задаваемые при установке сервера (server/.env) ---
  INST_ENABLED:        process.env.INST_ENABLED !== '0',          // включить механику инстансов
  INST_LOCK_HOURS:     Math.max(1, parseInt(process.env.INST_LOCK_HOURS || '168', 10)), // жизнь lock ID (недельный сброс)
  INST_BOTS_ALLOWED:   process.env.INST_BOTS_ALLOWED !== '0',     // соло-игра с ботами
  INST_DIFF_MULT:      Math.min(3, Math.max(1, parseInt(process.env.INST_DIFF_MULT || '3', 10))), // 1..3 доступных сложности
  INST_AUTOLOOT:       process.env.INST_AUTOLOOT !== '0',         // автовыдача наград за босса
  INST_MAX_CONCURRENT: Math.max(1, parseInt(process.env.INST_MAX_CONCURRENT || '50', 10)), // одновременных активных зон
  ALLOW_REG:      process.env.ALLOW_REG !== '0',
  LOG_LEVEL:      process.env.LOG_LEVEL || 'info',
};
const BIND_ADDR = CFG.PUBLIC_MODE ? '0.0.0.0' : '127.0.0.1';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const log = (...a) => { if (LEVELS[CFG.LOG_LEVEL] <= 1) console.log(...a); };
const warn = (...a) => { if (LEVELS[CFG.LOG_LEVEL] <= 2) console.warn(...a); };

// ------------------------------- БД ---------------------------------------
let pool = null;                                   // mysql2 promise pool
const mem = {                                      // фолбэк-хранилище (NO_DB=1)
  accounts: new Map(),      // email(lower) -> row
  characters: new Map(),    // `${accId}:${worldId}` -> row
  chat: [],                 // {world_id, author, channel, text, ts}
  whispers: [],             // {world_id, from_name, to_name, text, ts}
  system_log: [],           // {world_id, kind, text, ts}
  chat_settings: {},        // ключ -> значение (фолбэк без БД)
  worlds: [
    { id: 'nwm-1', name: 'Первый Костёр', seed: 20261102, pop: 'высокая' },
    { id: 'nwm-2', name: 'Люминитовый Разлом', seed: 770211, pop: 'средняя' },
    { id: 'nwm-3', name: 'Пепел Аэрии', seed: 411007, pop: 'низкая' },
    { id: 'nwm-4', name: 'Сумеречная Роща', seed: 902113, pop: 'высокая' },
  ],
};
let nextAccId = 1, nextCharId = 1;

// ------------------------- ГМ: уровни и полномочия ------------------------
const GM_PERMS = {
  announce:   1,   // /gm announce — баннер всем мирам
  motd:       1,   // /gm motd — объявление при входе
  who:        1,   // /gm who — онлайн-список
  online:     1,   // /gm online — счётчик по мирам
  char_find:  1,   // /gm find <имя> — поиск персонажа
  teleport:   2,   // /gm tp <игрок> [x z] — телепорт игрока к себе или в координаты
  kick:       2,   // /gm kick <игрок> [причина] — разрыв WS-сессии
  mute:       2,   // /gm mute <игрок> <сек> | unmute — заглушка чата
  char_info:  2,   // /gm info <имя> — сводка по персонажу из БД
  spawn_xp:   3,   // /gm xp <игрок> <кол-во> — начислить опыт (через клиента-владелец сессии не обязателен)
  world_msg:  3,   // /gm world <мир> <текст> — сообщение в конкретный мир
  ban:        3,   // /gm ban <email> <мин> [причина] | unban — бан аккаунта
  grant_gm:   9,   // /gm add_gm|del_gm — выдача/снятие ГМ (только владелец)
  shutdown:   9,   // /gm shutdown [сек] — остановка сервера (только владелец)
};
const GM_LEVELS = { 1: 'Модератор', 2: 'ГМ', 3: 'Старший ГМ', 9: 'Владелец' };
const gmPermsForLevel = (lvl) => Object.keys(GM_PERMS).filter(p => GM_PERMS[p] <= lvl);
const memGm = new Map();                                 // email(lower) -> {level, perms:[..]}
const banned = new Map();                                // email(lower) -> expireTs (в памяти + БД)

function gmLevelOf(acc) {                                // acc: {email} или id
  const key = String(acc.email || '').toLowerCase();
  if (memGm.has(key)) return memGm.get(key).level;
  return 0;
}
function gmCan(level, perm) { return level >= 9 || (GM_PERMS[perm] !== undefined && GM_PERMS[perm] <= level); }

async function loadGmTable() {                            // синхронизация ядро↔БД при старте
  if (!pool) return;
  try {
    await q(`CREATE TABLE IF NOT EXISTS gm_accounts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      account_id INT UNSIGNED NOT NULL UNIQUE,
      gm_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
      perms TEXT NULL, note VARCHAR(120) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await q(`CREATE TABLE IF NOT EXISTS audit_log (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      gm_email VARCHAR(190) NOT NULL, command VARCHAR(48) NOT NULL,
      args VARCHAR(500) NOT NULL DEFAULT '', result VARCHAR(255) NOT NULL DEFAULT '',
      ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_ts (ts))`);
    await q(`CREATE TABLE IF NOT EXISTS bans (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(190) NOT NULL UNIQUE, reason VARCHAR(200) NOT NULL DEFAULT '',
      expires_at TIMESTAMP NULL, banned_by VARCHAR(190) NOT NULL DEFAULT 'system',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const rows = await q(`SELECT a.email, g.gm_level FROM gm_accounts g JOIN accounts a ON a.id=g.account_id`);
    for (const r of rows || []) memGm.set(String(r.email).toLowerCase(), { level: Number(r.gm_level) });
    const bb = await q('SELECT email, UNIX_TIMESTAMP(expires_at)*1000 AS exp FROM bans WHERE expires_at IS NULL OR expires_at > NOW()');
    for (const r of bb || []) if (r.exp === null || r.exp > Date.now()) banned.set(String(r.email).toLowerCase(), r.exp ?? Infinity);
    log(`[gm] загружено ГМ: ${memGm.size}, активных банов: ${banned.size}`);
  } catch (e) { warn('[gm] таблица ГМ недоступна:', e.message); }
}
async function audit(gmEmail, command, args, result) {
  log(`[gm:${gmEmail}] ${command} ${args} → ${result}`);
  if (pool) q('INSERT INTO audit_log (gm_email, command, args, result) VALUES (?,?,?,?)', [gmEmail, command, String(args).slice(0, 500), String(result).slice(0, 255)]).catch(() => {});
}

// ---- ГМ-хелперы: поиск сессии/персонажа, бан, права ----
function findOnline(name) {
  const n = String(name || '').toLowerCase();
  for (const [sock, o] of online) if (o.name.toLowerCase() === n) return { sock, o };
  return null;
}
async function findCharByName(name) {                   // имя персонажа → строка characters (или mem)
  name = String(name || '');
  if (pool) {
    const rows = await q('SELECT c.*, a.email FROM characters c JOIN accounts a ON a.id=c.account_id WHERE c.name LIKE ? LIMIT 1', [`%${name}%`]);
    return rows && rows.length ? rows[0] : null;
  }
  for (const v of mem.characters.values()) if (String(v.name).toLowerCase().includes(name.toLowerCase())) return v;
  return null;
}
async function banEmail(email, minutes, reason, by) {
  email = String(email).toLowerCase();
  const exp = minutes > 0 ? Date.now() + minutes * 60000 : Infinity;
  banned.set(email, exp);
  if (pool) await q(`INSERT INTO bans (email, reason, expires_at, banned_by) VALUES (?,?,?,?)
                     ON DUPLICATE KEY UPDATE reason=VALUES(reason), expires_at=VALUES(expires_at), banned_by=VALUES(banned_by)`,
                    [email, String(reason||'').slice(0,200), minutes > 0 ? new Date(exp) : null, by]).catch(()=>{});
  const hit = findOnline((await findAccount(email))?.nick || '');   // выкинуть из игры, если онлайн по нику
  void hit;
  for (const [sock, o] of [...online]) {
    const acc = o.email ? await findAccount(o.email) : null;
    if (acc && acc.email === email) { wsSend(sock, { type: 'banned', reason }); setTimeout(() => sock.close(4001, 'banned'), 150); online.delete(sock); }
  }
}
async function unbanEmail(email) {
  email = String(email).toLowerCase();
  banned.delete(email);
  if (pool) await q('DELETE FROM bans WHERE email = ?', [email]).catch(()=>{});
}
async function setGm(email, level) {                    // level 0 — снять ГМ
  email = String(email).toLowerCase();
  const acc = await findAccount(email);
  if (!acc) throw new Error('Аккаунт не найден: ' + email);
  if (level <= 0) {
    memGm.delete(email);
    if (pool) await q('DELETE FROM gm_accounts WHERE account_id = ?', [acc.id]).catch(()=>{});
    return acc;
  }
  memGm.set(email, { level });
  if (pool) await q(`INSERT INTO gm_accounts (account_id, gm_level, perms, note) VALUES (?,?,?,?)
                     ON DUPLICATE KEY UPDATE gm_level=VALUES(gm_level), perms=VALUES(perms), note=VALUES(note)`,
                    [acc.id, level, JSON.stringify(gmPermsForLevel(level)), 'deploy.php']).catch(()=>{});
  return acc;
}
async function listGm() {
  if (pool) {
    const rows = await q('SELECT a.email, a.nick, g.gm_level FROM gm_accounts g JOIN accounts a ON a.id=g.account_id ORDER BY g.gm_level DESC');
    return (rows || []).map(r => ({ email: r.email, nick: r.nick, level: Number(r.gm_level), title: GM_LEVELS[r.gm_level] || 'ГМ' }));
  }
  return [...memGm.entries()].map(([email, g]) => ({ email, nick: '', level: g.level, title: GM_LEVELS[g.level] || 'ГМ' }));
}

async function initDb() {
  if (NO_DB) { console.log('[db] NO_DB=1 — хранилище в памяти'); return; }
  const mysql = require('mysql2/promise');
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
  };
  const dbName = process.env.DB_NAME || 'nvr_game';
  if (process.env.DB_AUTOINIT !== '0') {
    // применяем schema.sql (CREATE DATABASE IF NOT EXISTS ...)
    const admin = await mysql.createConnection({ ...cfg, database: undefined });
    const sql = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await admin.query(sql);
    await admin.end();
    console.log('[db] схема применена (schema.sql)');
  }
  pool = await mysql.createPool({ ...cfg, database: dbName, waitForConnections: true, connectionLimit: 10 });
  // сиды инстансов/квестов (34 зоны + 352 квеста) — идемпотентно, ON DUPLICATE KEY UPDATE
  try {
    if (require('fs').existsSync(path.join(__dirname, 'seed_instances.sql'))) {
      const seed = require('fs').readFileSync(path.join(__dirname, 'seed_instances.sql'), 'utf8');
      await pool.query(seed);
      console.log('[db] сиды instances/quests применены (seed_instances.sql)');
    }
  } catch (e) { console.warn('[db] seed_instances.sql:', e.message); }
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM accounts');
  console.log(`[db] MySQL ok: ${dbName}, аккаунтов: ${rows[0].n}`);
}

async function q(sql, params = []) {
  if (!pool) return null;
  const [res] = await pool.execute(sql, params);
  return res;
}

// ------------------------------ helpers -----------------------------------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const makeSalt = () => crypto.randomBytes(8).toString('hex');
const validEmail = (e) => /.+@.+\..+/.test(e || '');
const validNick = (n) => /^[\wА-Яа-яЁё \-]{2,16}$/.test((n || '').trim());
const validName = (n) => /^[A-Za-zА-Яа-яЁё0-9_\- ]{2,16}$/.test(n || '');

async function findAccount(email) {
  email = String(email).toLowerCase();
  if (pool) {
    const rows = await q('SELECT * FROM accounts WHERE email = ?', [email]);
    return rows && rows.length ? rows[0] : null;
  }
  return mem.accounts.get(email) || null;
}
function accountPayload(acc) {
  // контракт Auth.api(): клиент ждёт { email, nick, ... }
  return { email: acc.email, nick: acc.nick, createdAt: Number(acc.created_at ? new Date(acc.created_at) : Date.now()) };
}

// ------------------------------ HTTP API ----------------------------------
const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(ROOT));                    // сам отдаём клиент из корня проекта

app.get('/api/ping', (_req, res) => res.json({ ok: true, name: 'Ночь Военного Ремесла', time: Date.now(), online: online ? online.size : 0 }));

app.post('/api/register', async (req, res) => {
  try {
    if (!CFG.ALLOW_REG) return res.status(403).json({ error: 'Регистрация закрыта администратором сервера.' });
    const { email, password, nick } = req.body || {};
    if (!validEmail(email)) return res.status(400).json({ error: 'E-mail выглядит неполным.' });
    if ((password || '').length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов.' });
    if (!validNick(nick)) return res.status(400).json({ error: 'Ник: 2–16 букв/цифр/пробелов.' });
    if (await findAccount(email)) return res.status(409).json({ error: 'Такая учётная запись уже существует.' });
    const salt = makeSalt(), hash = sha256(salt + ':' + password);
    let acc;
    if (pool) {
      const r = await q('INSERT INTO accounts (email, nick, pass_hash, salt) VALUES (?,?,?,?)', [String(email).toLowerCase(), nick.trim(), hash, salt]);
      acc = { id: r.insertId, email: String(email).toLowerCase(), nick: nick.trim(), salt, pass_hash: hash, created_at: new Date() };
    } else {
      acc = { id: nextAccId++, email: String(email).toLowerCase(), nick: nick.trim(), salt, pass_hash: hash, created_at: new Date() };
      mem.accounts.set(acc.email, acc);
    }
    res.json(accountPayload(acc));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера.' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const acc = await findAccount(email);
    if (!acc) return res.status(401).json({ error: 'Учётная запись не найдена — зарегистрируйтесь.' });
    if (sha256(acc.salt + ':' + (password || '')) !== acc.pass_hash) return res.status(401).json({ error: 'Неверный пароль.' });
    // проверка бана (связка БД ↔ ядро)
    const bl = banned.get(String(acc.email).toLowerCase());
    if (bl !== undefined && (bl === Infinity || bl > Date.now())) {
      return res.status(403).json({ error: 'Учётная запись заблокирована администратором сервера.' });
    } else if (bl !== undefined) banned.delete(String(acc.email).toLowerCase());
    if (pool) await q('UPDATE accounts SET last_login = NOW() WHERE id = ?', [acc.id]);
    const gmLvl = gmLevelOf(acc);
    res.json({ ...accountPayload(acc), gm: gmLvl ? { level: gmLvl, title: GM_LEVELS[gmLvl] || 'ГМ', perms: gmPermsForLevel(gmLvl) } : null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера.' }); }
});

// ---- ГМ-команды через HTTP (дубликат WS-слоя; нужен для панелей и скриптов) ----
async function gmHttpAuth(req, res) {
  if (!authTok(req, res)) return false;
  const lvl = gmLevelOf({ email: req.acc.email });
  if (!lvl) { res.status(403).json({ error: 'Требуется ГМ-статус.' }); return false; }
  req.gm = { email: req.acc.email, level: lvl };
  return true;
}
app.get('/api/gm/status', authTok, async (req, res) => {
  const lvl = gmLevelOf({ email: req.acc.email });
  res.json({ gm: !!lvl, level: lvl, title: GM_LEVELS[lvl] || null, perms: lvl ? gmPermsForLevel(lvl) : [], online: online.size });
});
app.get('/api/gm/who', gmHttpAuth, (_req, res) => {
  const list = []; for (const o of online.values()) list.push({ name: o.name, world: o.worldId, level: o.level, gm: gmLevelOf({ email: o.email || '' }) });
  res.json(list);
});
app.get('/api/gm/audit', gmHttpAuth, async (req, res) => {
  if (req.gm.level < 2) return res.status(403).json({ error: 'Нужен уровень ≥2.' });
  if (!pool) return res.json([]);
  const rows = await q('SELECT gm_email, command, args, result, ts FROM audit_log ORDER BY id DESC LIMIT 100');
  res.json(rows || []);
});
app.post('/api/gm/ban', gmHttpAuth, async (req, res) => {
  if (!gmCan(req.gm.level, 'ban')) return res.status(403).json({ error: 'Недостаточно прав (нужен Старший ГМ).' });
  const email = String((req.body || {}).email || '').toLowerCase();
  const mins = Math.max(0, parseInt((req.body || {}).minutes || '60', 10));
  const reason = String((req.body || {}).reason || '').slice(0, 200);
  if (!validEmail(email)) return res.status(400).json({ error: 'Некорректный e-mail.' });
  const exp = Date.now() + mins * 60000;
  banned.set(email, mins ? exp : Infinity);
  if (pool) q('INSERT INTO bans (email, reason, expires_at, banned_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE reason=VALUES(reason), expires_at=VALUES(expires_at), banned_by=VALUES(banned_by)',
    [email, reason, mins ? new Date(exp) : null, req.gm.email]).catch(() => {});
  for (const [sock, o] of online) if (o.email && o.email.toLowerCase() === email) { wsSend(sock, { type: 'banned', reason }); setTimeout(() => sock.close(4001, 'banned'), 150); online.delete(sock); }
  audit(req.gm.email, 'ban', `${email} ${mins}мин ${reason}`, 'ok');
  res.json({ ok: true });
});
app.post('/api/gm/unban', gmHttpAuth, async (req, res) => {
  if (!gmCan(req.gm.level, 'ban')) return res.status(403).json({ error: 'Недостаточно прав.' });
  const email = String((req.body || {}).email || '').toLowerCase();
  banned.delete(email);
  if (pool) await q('DELETE FROM bans WHERE email = ?', [email]).catch(() => {});
  audit(req.gm.email, 'unban', email, 'ok');
  res.json({ ok: true });
});
app.post('/api/gm/announce', gmHttpAuth, (req, res) => {
  if (!gmCan(req.gm.level, 'announce')) return res.status(403).json({ error: 'Недостаточно прав.' });
  const text = String((req.body || {}).text || '').slice(0, 200);
  broadcast(null, { type: 'announce', text, channel: 'system' });
  audit(req.gm.email, 'announce', text, 'sent');
  res.json({ ok: true });
});
app.get('/api/gm/list', gmHttpAuth, async (_req, res) => res.json(await listGm()));
app.post('/api/gm/add_gm', gmHttpAuth, async (req, res) => {
  if (!gmCan(req.gm.level, 'grant_gm')) return res.status(403).json({ error: 'Только владелец сервера.' });
  try { await setGm(String((req.body||{}).email||''), Math.max(1, Math.min(9, parseInt((req.body||{}).level||'2',10))));
    audit(req.gm.email, 'add_gm', JSON.stringify(req.body||{}), 'ok'); res.json({ ok: true, gm: await listGm() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/gm/del_gm', gmHttpAuth, async (req, res) => {
  if (!gmCan(req.gm.level, 'grant_gm')) return res.status(403).json({ error: 'Только владелец сервера.' });
  try { await setGm(String((req.body||{}).email||''), 0);
    audit(req.gm.email, 'del_gm', String((req.body||{}).email||''), 'ok'); res.json({ ok: true, gm: await listGm() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// список миров (для экрана выбора) — берём из БД
app.get('/api/worlds', async (_req, res) => {
  if (pool) {
    const rows = await q('SELECT id, name, seed, pop FROM worlds ORDER BY id');
    return res.json(rows.map(w => ({ id: w.id, name: w.name, seed: Number(w.seed), pop: w.pop })));
  }
  res.json(mem.worlds);
});

// ---- персонажи (нужен токен аккаунта) ----
// Чат-системы: настройки, история и личные сообщения через REST (связь БД↔игра)
app.get('/api/chat/settings', (_req, res) => {
  res.json({
    channels: chatChannelsPublic(),
    whisperRatePerSec: CFG.WHISPER_RATE, sysJoinLeave: CFG.SYS_JOIN_LEAVE,
    chatRatePerSec: CFG.CHAT_RATE_PER_S, maxLen: 200, localRadius: CFG.LOCAL_RADIUS || 40,
  });
});
app.post('/api/chat/settings', async (req, res) => {        // из deploy.php / ГМ-панели без рестарта
  const allowed = ['CHAT_GLOBAL_ON','CHAT_LOCAL_ON','CHAT_PARTY_ON','CHAT_WHISPER_ON','CHAT_SYSTEM_ON','CHAT_GM_ON','WHISPER_RATE_PER_S','SYS_JOIN_LEAVE'];
  const b = req.body || {};
  for (const k of allowed) if (b[k] !== undefined) await saveChatSetting(k, String(b[k]));
  log('[chat] настройки обновлены через API');
  res.json({ ok: true, channels: chatChannelsPublic() });
});
app.get('/api/chat/history', authTok, async (req, res) => { // последние сообщения канала мира
  const world = String(req.query.world || 'nwm-1').slice(0, 16);
  const channel = String(req.query.channel || 'global').toLowerCase();
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '30', 10)));
  if (pool) {
    try {
      const rows = await q(`SELECT author, channel, text, ts FROM chat_log WHERE world_id=? AND channel=? ORDER BY id DESC LIMIT ${limit}`, [world, channel === 'whisper' ? 'global' : channel]);
      return res.json((rows || []).reverse());
    } catch (_) { return res.json([]); }
  }
  res.json(mem.chat.filter(c => c.world_id === world && c.channel === (channel === 'whisper' ? 'global' : channel)).slice(-limit));
});
app.get('/api/chat/whispers', authTok, async (req, res) => { // личная переписка игрока
  const peer = String(req.query.with || '');
  const meName = String(req.query.name || '');
  if (!meName || !peer) return res.status(400).json({ error: 'Нужны name и with.' });
  res.json(await whisperHistory(meName, peer, parseInt(req.query.limit || '50', 10)));
});

// простой токен: base64(email:id:hmac). Секрет генерируется при старте.
// Секрет подписи токенов: берём из .env (TOKEN_SECRET), иначе стабильный
// по умолчанию — токены переживают перезапуск сервера.
const SECRET = process.env.TOKEN_SECRET || 'nvr-dev-secret-change-me';
function makeToken(acc) {
  const raw = `${acc.email}:${acc.id}`;
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex').slice(0, 32);
  return Buffer.from(`${raw}:${sig}`).toString('base64url');
}
function authTok(req, res) {
  const t = req.headers['x-token'] || req.query.token || '';
  try {
    const [email, id, sig] = Buffer.from(t, 'base64url').toString('utf8').split(':');
    const good = crypto.createHmac('sha256', SECRET).update(`${email}:${id}`).digest('hex').slice(0, 32);
    if (!good || sig !== good) throw 0;
    req.acc = { email: email.toLowerCase(), id: parseInt(id, 10) };
    return true;
  } catch (_) { res.status(401).json({ error: 'Требуется вход.' }); return false; }
}
app.post('/api/token', async (req, res) => {       // обмен логина на токен (для сохранения персонажа)
  try {
    const acc = await findAccount((req.body && req.body.email) || '');
    if (!acc || sha256(acc.salt + ':' + ((req.body && req.body.password) || '')) !== acc.pass_hash) return res.status(401).json({ error: 'Неверные данные.' });
    res.json({ token: makeToken(acc), account: accountPayload(acc) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера.' }); }
});

app.get('/api/characters', authTok, async (req, res) => {
  if (pool) {
    const rows = await q('SELECT world_id, name, updated_at FROM characters WHERE account_id = ?', [req.acc.id]);
    return res.json(rows);
  }
  const out = [];
  for (const v of mem.characters.values()) if (v.account_id === req.acc.id) out.push({ world_id: v.world_id, name: v.name, updated_at: v.updated_at });
  res.json(out);
});

app.get('/api/character/:world', authTok, async (req, res) => {
  const w = String(req.params.world || '').slice(0, 16);
  if (pool) {
    const rows = await q('SELECT save_json FROM characters WHERE account_id = ? AND world_id = ?', [req.acc.id, w]);
    if (!rows.length) return res.json(null);
    return res.json(JSON.parse(rows[0].save_json));
  }
  const row = mem.characters.get(`${req.acc.id}:${w}`);
  res.json(row ? JSON.parse(row.save_json) : null);
});

app.post('/api/character/:world', authTok, async (req, res) => {
  try {
    const w = String(req.params.world || '').slice(0, 16);
    const save = req.body || {};
    const name = String(save.name || '');
    if (!validName(name)) return res.status(400).json({ error: 'Некорректное имя персонажа.' });
    const json = JSON.stringify(save);
    if (json.length > 200000) return res.status(413).json({ error: 'Сохранение слишком большое.' });
    if (pool) {
      await q(`INSERT INTO characters (account_id, world_id, name, save_json) VALUES (?,?,?,?)
               ON DUPLICATE KEY UPDATE name=VALUES(name), save_json=VALUES(save_json)`, [req.acc.id, w, name, json]);
    } else {
      mem.characters.set(`${req.acc.id}:${w}`, { account_id: req.acc.id, world_id: w, name, save_json: json, updated_at: new Date() });
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сохранения.' }); }
});

// --------------------------- WebSocket MMO --------------------------------
// протокол совпадает с src/game/net.js PROTO: hello/welcome/spawn/despawn/move/chat/emote
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: CFG.WS_PATH });
const online = new Map();                          // socket -> {name, cls, x, z, worldId}
const muted = new Map();                           // name(lower) -> expireTs
let MOTD = 'Добро пожаловать в Эфирию. Свет — твоё оружие, тьма — твой враг.';

// ================= ЧАТ-СИСТЕМЫ: мир / шёпот / система ======================
// Каналы: global (мировой), local (рядом с говорящим), party (группа),
// whisper (личные сообщения /w), system (системная информация), guild/gm.
const CHAN_COLORS = { global: '#cfe3ff', local: '#9fd8a4', party: '#7ec8ff', whisper: '#e6a3ff', system: '#ffd97a', gm: '#ff8a8a' };
const chanOn = (ch) => ({
  global: CFG.CHAT_GLOBAL_ON, local: CFG.CHAT_LOCAL_ON, party: CFG.CHAT_PARTY_ON,
  whisper: CFG.CHAT_WHISPER_ON, system: CFG.CHAT_SYSTEM_ON, gm: CFG.CHAT_GM_ON,
}[ch] !== false);

// загрузка настроек чата из БД (таблица chat_settings пишет deploy.php §3)
async function loadChatSettings() {
  const keys = ['CHAT_GLOBAL_ON','CHAT_LOCAL_ON','CHAT_PARTY_ON','CHAT_WHISPER_ON','CHAT_SYSTEM_ON','CHAT_GM_ON','WHISPER_RATE_PER_S','SYS_JOIN_LEAVE'];
  if (pool) {
    try {
      await q(`CREATE TABLE IF NOT EXISTS chat_settings (k VARCHAR(48) PRIMARY KEY, v VARCHAR(255) NOT NULL)`);
      const rows = await q('SELECT k, v FROM chat_settings');
      for (const r of rows || []) {
        const k = String(r.k), v = String(r.v);
        if (!keys.includes(k)) continue;
        if (k === 'WHISPER_RATE_PER_S') CFG.WHISPER_RATE = Math.max(0, parseInt(v, 10) || 0);
        else CFG[k.replace('_PER_S', '')] = v !== '0';
      }
      log('[chat] настройки из БД загружены');
    } catch (e) { warn('[chat] chat_settings недоступна:', e.message); }
  } else {
    for (const k of keys) if (mem.chat_settings[k] !== undefined) {
      if (k === 'WHISPER_RATE_PER_S') CFG.WHISPER_RATE = Math.max(0, parseInt(mem.chat_settings[k], 10) || 0);
      else CFG[k] = mem.chat_settings[k] !== '0';
    }
  }
}
async function saveChatSetting(k, v) {              // hot-update из REST/GM без рестарта
  if (k === 'WHISPER_RATE_PER_S') CFG.WHISPER_RATE = Math.max(0, parseInt(v, 10) || 0);
  else CFG[k] = String(v) !== '0';
  if (pool) q('INSERT INTO chat_settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [k, String(v)]).catch(() => {});
  else mem.chat_settings[k] = String(v);
}

// рассылка системной информации (+журнал в system_log)
function sysMsg(worldId, text, kind = 'info', toSock = null) {
  if (!CFG.CHAT_SYSTEM_ON && !toSock) return;
  const t = String(text).slice(0, CFG.SYS_MAX_LEN);
  const obj = { type: 'chat', author: 'СИСТЕМА', text: t, channel: 'system', color: CHAN_COLORS.system, kind };
  if (toSock) wsSend(toSock, obj);
  else for (const [sock, o] of online) if (!worldId || o.worldId === worldId) wsSend(sock, obj);
  if (pool) q('INSERT INTO system_log (world_id, kind, text) VALUES (?,?,?)', [worldId || '*', kind, t]).catch(() => {});
  else mem.system_log.push({ world_id: worldId || '*', kind, text: t, ts: new Date() });
}

// доставка сообщения игроку по имени (в тот же мир); возвращает true если найден
function sendToPlayer(name, obj) {
  const n = String(name || '').toLowerCase();
  let hit = false;
  for (const [sock, o] of online) if (o.name.toLowerCase() === n) { wsSend(sock, obj); hit = true; }
  return hit;
}

// личные сообщения: /w <игрок> <текст> · /whisper · /лс · /ш
function handleWhisper(ws, me, raw) {
  if (!CFG.CHAT_WHISPER_ON) { wsSend(ws, { type: 'notice', text: 'Личные сообщения отключены на сервере.' }); return true; }
  const sp = String(raw).trim().split(/\s+/);
  const to = sp.shift();
  const text = sp.join(' ');
  if (!to || !text) { wsSend(ws, { type: 'notice', text: 'Формат: /w Имя текст (или /лс Имя текст).' }); return true; }
  if (to.toLowerCase() === me.name.toLowerCase()) { wsSend(ws, { type: 'notice', text: 'Себе писать не стоит.' }); return true; }
  if (!sendToPlayer(to, { type: 'chat', author: me.name, text: text.slice(0, 200), channel: 'whisper', color: CHAN_COLORS.whisper, whisper: true, dir: 'in' })) {
    wsSend(ws, { type: 'notice', text: `Игрок «${to}» сейчас не в сети.` }); return true;
  }
  wsSend(ws, { type: 'chat', author: me.name, text: text.slice(0, 200), channel: 'whisper', color: CHAN_COLORS.whisper, whisper: true, dir: 'out', target: to });
  if (pool) q('INSERT INTO whispers (world_id, from_name, to_name, text) VALUES (?,?,?,?)', [me.worldId, me.name, to, text.slice(0, 200)]).catch(() => {});
  else mem.whispers.push({ world_id: me.worldId, from_name: me.name, to_name: to, text: text.slice(0, 200), ts: new Date() });
  return true;
}

// история переписки (REST + /gm logs): последние N сообщений с игроком
async function whisperHistory(meName, peer, limit = 30) {
  const lim = Math.max(1, Math.min(200, limit | 0));
  if (pool) {
    try {
      const rows = await q(`SELECT from_name, to_name, text, ts FROM whispers
        WHERE (from_name=? AND to_name=?) OR (from_name=? AND to_name=?) ORDER BY id DESC LIMIT ${lim}`,
        [meName, peer, peer, meName]);
      return (rows || []).reverse();
    } catch (_) { return []; }
  }
  const m = meName.toLowerCase(), p = String(peer).toLowerCase();
  return mem.whispers.filter(w => (w.from_name.toLowerCase() === m && w.to_name.toLowerCase() === p) ||
                                  (w.from_name.toLowerCase() === p && w.to_name.toLowerCase() === m)).slice(-lim);
}

// публичное описание каналов (отправляется клиенту в welcome)
function chatChannelsPublic() {
  const list = [
    { id: 'global',  name: 'Мир',      color: CHAN_COLORS.global },
    { id: 'local',   name: 'Окрестности', color: CHAN_COLORS.local },
    { id: 'party',   name: 'Группа',   color: CHAN_COLORS.party },
    { id: 'whisper', name: 'Личное',   color: CHAN_COLORS.whisper },
    { id: 'system',  name: 'Система',  color: CHAN_COLORS.system },
    { id: 'gm',      name: 'ГМ',       color: CHAN_COLORS.gm },
  ];
  return list.filter(c => chanOn(c.id));
}

// ---------------------- анти-флуд / рейт-лимиты ---------------------------
class TokenBucket {
  constructor(ratePerSec, burst) { this.rate = ratePerSec; this.cap = Math.max(1, burst); this.tokens = this.cap; this.t = Date.now(); }
  take(n = 1) {
    const now = Date.now();
    this.tokens = Math.min(this.cap, this.tokens + ((now - this.t) / 1000) * this.rate);
    this.t = now;
    if (this.tokens >= n) { this.tokens -= n; return true; }
    return false;
  }
}

function wsSend(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(sender, obj, sameWorldOnly = true) {
  for (const [sock, meta] of online) {
    if (sock === sender) continue;
    if (sameWorldOnly && meta.worldId && obj.worldId && meta.worldId !== obj.worldId) continue;
    wsSend(sock, obj);
  }
}


// ======================= ИНСТАНСЫ: серверная механика ========================
// Справочник зон — синхронизирован с src/data/instances.js и таблицей `instances`.
const INSTANCES_DEF = require('./instances_def.json');   // 34 зоны
const instLocks = [];                                     // активные замки (lock id)
const instRuns  = new Map();                              // id -> состояние забега
let instSeq = 0;

function instConf(instId) { return INSTANCES_DEF.find(i => i.id === instId) || null; }
function instDiffMult(diff) { return diff === 'mythic' ? 2.6 : diff === 'heroic' ? 1.7 : 1.0; }

function myLocks(name, worldId) {
  const now = Date.now();
  for (let i = instLocks.length - 1; i >= 0; i--) if (instLocks[i].expiresAt < now) instLocks.splice(i, 1);
  return instLocks.filter(l => l.worldId === worldId && l.party.some(n => n === name));
}

function instCreateRun(me, instId, diff, partyNames) {
  const def = instConf(instId);
  if (!def) return { error: 'Инстанс не найден в справочнике сервера.' };
  if (!CFG.INST_ENABLED) return { error: 'Инстансы отключены настройкой INST_ENABLED=0.' };
  if (diff === 'heroic' && CFG.INST_DIFF_MULT < 2) return { error: 'Героическая сложность выключена на этом сервере.' };
  if (diff === 'mythic' && CFG.INST_DIFF_MULT < 3) return { error: 'Мифическая сложность выключена на этом сервере.' };
  const party = (partyNames || [me.name]).slice(0, def.size).filter(Boolean);
  if (party.length > 1 && !CFG.INST_BOTS_ALLOWED && party.some(n => n !== me.name)) {
    // боты разрешены только если INST_BOTS_ALLOWED=1; живые игроки проходят всегда
  }
  if (instRuns.size >= CFG.INST_MAX_CONCURRENT) return { error: 'Сервер перегружен забегами, попробуй позже.' };
  const locked = myLocks(me.name, me.worldId).find(l => l.instId === instId && l.diff === diff && !l.completed);
  if (locked) return { error: 'У тебя уже есть незавершённый замок этой зоны (lock ID #' + locked.id + '). Пройди или дождись сброса.' };
  const run = {
    id: ++instSeq, instId, diff, leader: me.name, party,
    wave: 0, mobsLeft: def.mobs.reduce((a, m) => a + m[1], 0), bossDown: false,
    startedAt: Date.now(), timerMs: def.timerMin * 60000, mult: instDiffMult(diff),
    ws: me, state: 'running',
  };
  const lock = { id: 'L' + instSeq, instId, diff, worldId: me.worldId, leaderName: me.name, party, createdAt: Date.now(), expiresAt: Date.now() + CFG.INST_LOCK_HOURS * 3600e3, completed: false, runId: run.id };
  instLocks.push(lock);
  instRuns.set(run.id, run);
  q('INSERT INTO instance_locks (world_id, inst_id, diff, leader_name, party_json, expires_at) VALUES (?,?,?,?,?,FROM_UNIXTIME(?))',
    [me.worldId, instId, diff, me.name, JSON.stringify(party), Math.floor(lock.expiresAt / 1000)]).catch(() => {});
  sysMsg(me.worldId, `${me.name} открыл(а) инстанс «${def.name}» (${diff}, ${party.length} чел., lock #${lock.id}).`, 'event');
  return { run, lock };
}

function instWaveClear(run) {
  const def = instConf(run.instId);
  run.wave++;
  q('INSERT INTO instance_progress (lock_id, wave_no, mobs_killed) VALUES (?,?,?)', [run.lockDbId || run.id, run.wave, def.mobs.reduce((a,m)=>a+m[1],0)]).catch(()=>{});
  if (run.wave >= def.waves) return instFinish(run, true);
  return { type: 'inst_wave', runId: run.id, wave: run.wave, total: def.waves, nextBoss: run.wave === def.waves - 1 };
}

function instFinish(run, success) {
  const def = instConf(run.instId);
  run.state = success ? 'cleared' : 'failed';
  const lk = instLocks.find(l => l.runId === run.id);
  if (lk) lk.completed = success;
  if (success && CFG.INST_AUTOLOOT) {
    const rw = def.rewards;
    wsSend(run.ws, { type: 'inst_reward', runId: run.id, xp: Math.round(rw.xp * run.mult), gold: Math.round(rw.gold * run.mult), loot: rw.loot, rep: rw.rep });
  }
  sysMsg(run.wsWorld || 'nwm-1', `Забег «${def.name}»: ${success ? 'зона зачищена' : 'таймер истёк'}.`, 'event');
  setTimeout(() => instRuns.delete(run.id), 60000);
  return { type: 'inst_end', runId: run.id, success };
}

function instPublicList(name, worldId) {
  const locks = myLocks(name, worldId).map(l => ({ lockId: l.id, instId: l.instId, diff: l.diff, completed: l.completed, expiresInH: Math.max(0, Math.round((l.expiresAt - Date.now()) / 3600e3) / 1) }));
  return { type: 'inst_list', instances: INSTANCES_DEF.map(d => ({ id: d.id, num: d.num, name: d.name, theme: d.theme, diff: d.diff, size: d.size, levelMin: d.levelMin, levelMax: d.levelMax, waves: d.waves, boss: d.boss, timerMin: d.timerMin, keyReq: d.keyReq, enabled: CFG.INST_ENABLED })), locks, cfg: { enabled: CFG.INST_ENABLED, bots: CFG.INST_BOTS_ALLOWED, diffMult: CFG.INST_DIFF_MULT, lockHours: CFG.INST_LOCK_HOURS } };
}

wss.on('connection', (ws) => {
  // лимит одновременных соединений
  if (online.size >= CFG.MAX_PLAYERS_WS) {
    wsSend(ws, { type: 'error', error: 'Сервер переполнен: достигнут максимум игроков онлайн.' });
    setTimeout(() => ws.close(1013, 'full'), 200);
    return;
  }
  let me = null;
  const buckets = {
    move: new TokenBucket(CFG.MOVE_RATE_HZ, CFG.MOVE_RATE_HZ * 2),
    chat: new TokenBucket(CFG.CHAT_RATE_PER_S || 0.0001, Math.max(2, (CFG.CHAT_RATE_PER_S || 1) * 2)),
    any:  new TokenBucket(80, 160),                  // общий лимит пакетов
  };
  ws.__lastMsg = Date.now();
  ws.on('message', async (buf) => {
    ws.__lastMsg = Date.now();
    if (!buckets.any.take()) return;                 // грубый флуд — тихо режем
    let m; try { m = JSON.parse(buf.toString()); } catch (_) { return; }
    switch (m.type) {
      case 'hello': {
        if (me) return;                              // повторный hello игнорируем
        me = { name: String(m.name || 'Странник').slice(0, 16), worldId: m.world || 'nwm-1', x: 0, z: 0, level: m.level || 1, cls: m.cls || 'warden', email: String(m.email || '').toLowerCase(), gm: 0 };
        // ГМ-статус по аккаунту (связка: токен/е-мейл клиента ↔ таблица gm_accounts)
        if (me.email && memGm.has(me.email)) me.gm = memGm.get(me.email).level;
        online.set(ws, me);
        // шлём всем уже присутствующим о новичке
        broadcast(null, { type: 'spawn', entity: { id: ws.__id || (ws.__id = crypto.randomUUID()), kind: 'player', name: me.name, cls: me.cls, color: me.gm ? '#ff5f5f' : '#d9a441', level: me.level, gm: me.gm, x: me.x, z: me.z, worldId: me.worldId } }, true);
        // и новичку — про всех остальных
        for (const [sock, o] of online) {
          if (sock === ws) continue;
          wsSend(ws, { type: 'spawn', entity: { id: sock.__id, kind: 'player', name: o.name, cls: o.cls, color: o.gm ? '#ff5f5f' : '#d9a441', level: o.level, gm: o.gm, x: o.x, z: o.z } });
        }
        wsSend(ws, { type: 'welcome', id: ws.__id, motd: MOTD, gm: me.gm, gmTitle: me.gm ? (GM_LEVELS[me.gm] || 'ГМ') : null, perms: me.gm ? gmPermsForLevel(me.gm) : [], channels: chatChannelsPublic() });
        if (CFG.SYS_JOIN_LEAVE) sysMsg(me.worldId, `${me.name} входит в мир. Свети осторожно.`, 'event');
        break;
      }
      case 'move': {
        if (!me) return;
        if (!buckets.move.take()) return;            // превышен MOVE_RATE_HZ — пакет отброшен
        me.x = +m.x || 0; me.z = +m.z || 0; me.r = +m.r || 0;
        broadcast(ws, { type: 'move', id: ws.__id, x: me.x, z: me.z, r: me.r });
        break;
      }
      case 'chat': {
        if (!me) return;
        if (!buckets.chat.take()) { wsSend(ws, { type: 'notice', text: 'Слишком часто — подожди мгновение.' }); return; }
        let text = String(m.text || '').slice(0, 200);
        if (!text) return;
        // ГМ-команды: /gm <cmd> ... (полномочия проверяются по уровню)
        if (/^\/?gm[\s:]/i.test(text.trim())) { handleGm(ws, me, text.trim().replace(/^\/?gm[\s:]+/i, '')); break; }
        // личные сообщения: /w · /whisper · /лс · /ш (+ история /wh history)
        let wm = text.match(/^\/(?:w|whisper|лс|ш)\s+(.*)$/i);
        if (wm) { handleWhisper(ws, me, wm[1]); break; }
        if (/^\/(?:wh|лсих)\s+(\S+)\s*$/.test(text)) {   // /wh <игрок> — история переписки
          const peer = text.match(/^\/(?:wh|лсих)\s+(\S+)\s*$/i)[1];
          const h = await whisperHistory(me.name, peer, 20);
          if (!h.length) wsSend(ws, { type: 'notice', text: `Переписки с «${peer}» нет.` });
          else for (const r of h.slice(-8)) wsSend(ws, { type: 'chat', author: r.from_name, text: r.text, channel: 'whisper', color: CHAN_COLORS.whisper, whisper: true, dir: r.from_name.toLowerCase() === me.name.toLowerCase() ? 'out' : 'in', target: peer });
          break;
        }
        const mu = muted.get(me.name.toLowerCase());
        if (mu && mu > Date.now()) { wsSend(ws, { type: 'notice', text: `Вы заглушены до ${new Date(mu).toLocaleTimeString('ru-RU')} (ГМ-модерация).` }); break; }
        // выбор канала: из пакета или по префиксу /channel
        let ch = String(m.channel || 'global').toLowerCase();
        const cm = text.match(/^\/(global|world|local|party|group|system|gm|guild)\s+(.*)$/i);
        if (cm) { ch = cm[1].toLowerCase(); text = cm[2]; }
        if (ch === 'world') ch = 'global';
        if (ch === 'group') ch = 'party';
        if (!chanOn(ch)) { wsSend(ws, { type: 'notice', text: `Канал «${ch}» отключён на сервере.` }); break; }
        const out = { type: 'chat', author: me.name, text, channel: ch, color: me.gm ? CHAN_COLORS.gm : (CHAN_COLORS[ch] || CHAN_COLORS.global), gm: !!me.gm };
        // доставка по каналу
        if (ch === 'local') {          // только те, кто рядом с говорящим
          for (const [sock, o] of online) {
            if (sock === ws || o.worldId !== me.worldId) continue;
            if (Math.hypot(o.x - me.x, o.z - me.z) <= (CFG.LOCAL_RADIUS || 40)) wsSend(sock, out);
          }
        } else broadcast(null, out, true);
        wsSend(ws, out);               // эхо отправителю (клиент в live-режиме сам не дублирует)
        if (pool) q('INSERT INTO chat_log (world_id, author, channel, text) VALUES (?,?,?,?)', [me.worldId, me.name, ch, text]).catch(() => {});
        else mem.chat.push({ world_id: me.worldId, author: me.name, channel: ch, text, ts: new Date() });
        break;
      }
      case 'emote': {
        if (!me) return;
        broadcast(ws, { type: 'emote', id: ws.__id, name: String(m.name || 'поклон').slice(0, 16) });
        break;
      }
      case 'inst.list': wsSend(ws, instPublicList(me ? me.name : '', me ? me.worldId : 'nwm-1')); break;
      case 'inst.create': {
        if (!me) break;
        const r = instCreateRun(me, String(m.instId || ''), ['normal','heroic','mythic'].includes(m.diff) ? m.diff : 'normal', Array.isArray(m.party) ? m.party : [me.name]);
        if (r.error) { wsSend(ws, { type: 'inst_error', error: r.error }); break; }
        const def = instConf(r.run.instId);
        wsSend(ws, { type: 'inst_enter', runId: r.run.id, lockId: r.lock.id, inst: def, diff: r.run.diff, mult: r.run.mult, party: r.run.party, wave: 0, timerMs: r.run.timerMs });
        break;
      }
      case 'inst.kill': {
        if (!me) break;
        const run = instRuns.get(+m.runId);
        if (!run || run.leader !== me.name) break;
        run.mobsLeft = Math.max(0, run.mobsLeft - 1);
        if (m.boss) run.bossDown = true;
        if (run.mobsLeft <= 0) { const ev = instWaveClear(run); wsSend(ws, ev); if (ev.type === 'inst_end') wsSend(ws, { type: 'inst_leave', runId: run.id }); }
        else wsSend(ws, { type: 'inst_progress', runId: run.id, mobsLeft: run.mobsLeft, wave: run.wave });
        break;
      }
      case 'inst.leave': {
        if (!me) break;
        const run = instRuns.get(+m.runId);
        if (run && run.leader === me.name) { const ev = instFinish(run, false); wsSend(ws, ev); }
        wsSend(ws, { type: 'inst_leave', runId: +m.runId });
        break;
      }
      case 'ping': wsSend(ws, { type: 'pong', t: m.t }); break;
      default: break;
    }
  });
  ws.on('close', () => {
    if (me) {
      broadcast(null, { type: 'despawn', id: ws.__id });
      if (CFG.SYS_JOIN_LEAVE) sysMsg(me.worldId, `${me.name} покидает мир.`, 'event');
    }
    online.delete(ws);
  });
});

setInterval(() => {                     // heartbeat + idle-таймаут (настраиваемые)
  const now = Date.now();
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    if (now - (ws.__lastMsg || now) > CFG.IDLE_TIMEOUT_MS) { ws.close(1000, 'idle'); continue; }
    ws.isAlive = false;
    try { ws.ping(); ws.once('pong', () => { ws.isAlive = true; }); } catch (_) {}
  }
}, CFG.HEARTBEAT_MS);

// игровой тик: серверное состояние мира (позже — единый источник истины для мобов/лутов)
let tickN = 0;
setInterval(() => { tickN++; }, CFG.TICK_MS);

// ---------------------- ГМ-консоль (WS-команды) ----------------------------
const GM_HELP = [
  'Доступные команды: who · online · find <имя> · info <имя> · announce <текст> · motd <текст>',
  'tp <игрок> [x z] · kick <игрок> [причина] · mute <игрок> <сек> · unmute <игрок>',
  'xp <игрок> <кол-во> · world <мир> <текст> · ban <email> <мин> [причина] · unban <email>',
  'add_gm <email> <уровень 1|2|3> · del_gm <email> · gmlist · help',
  'чат: wmsg <игрок> <текст> — системное ЛС · sysmsg <текст> — инфо всем в мире · channels · chat <канал> вкл|выкл',
  'инстансы: inst list · inst open <inst_id> [normal|heroic|mythic] · inst locks · inst clear <lock_id>',
];
async function handleGm(ws, me, raw) {
  const say = (t) => wsSend(ws, { type: 'notice', text: t });
  if (!me.gm) return say('Команды доступны только ГМ-учётным записям.');
  const sp = String(raw || '').trim().split(/\s+/);
  let cmd = (sp.shift() || '').toLowerCase();
  // поддержка написания «ГМ» по-русски: /gm гм who → who
  if (cmd === 'гм' && sp.length) cmd = sp.shift().toLowerCase();
  const needPerm = (p) => { if (!gmCan(me.gm, p)) { say(`Недостаточно прав: нужно «${p}» (ГМ ${GM_LEVELS[me.gm]}).`); return false; } return true; };
  switch (cmd) {
    case 'help': say(GM_HELP.join(' | ')); break;
    case 'who': {
      const l = [...online.values()].map(o => `${o.name}[${o.level}] ${o.worldId}${o.gm ? ' ★ГМ' : ''}`);
      say(`Онлайн (${l.length}): ${l.join(', ') || '—'}`); audit(me.email, 'who', '', `n=${l.length}`); break;
    }
    case 'online': {
      const byW = {}; for (const o of online.values()) byW[o.worldId] = (byW[o.worldId] || 0) + 1;
      say(`Онлайн по мирам: ${Object.entries(byW).map(([w, n]) => `${w}=${n}`).join(' · ') || 'пусто'} (всего ${online.size})`); break;
    }
    case 'find': case 'info': {
      if (!needPerm(cmd === 'find' ? 'char_find' : 'char_info')) break;
      const ch = await findCharByName(sp.join(' '));
      if (!ch) return say('Персонаж не найден в базе.');
      let lvl = '?'; try { lvl = JSON.parse(ch.save_json).level ?? '?'; } catch (_) {}
      say(`${ch.name}: мир=${ch.world_id}, уровень=${lvl}, аккаунт=${ch.email || '?'}, обновлён=${ch.updated_at || ''}`);
      audit(me.email, cmd, sp.join(' '), ch.name); break;
    }
    case 'announce': case 'motd': {
      if (!needPerm(cmd)) break;
      const text = sp.join(' ').slice(0, 200);
      if (!text) return say('Пустой текст.');
      if (cmd === 'motd') { MOTD = text; say('MOTD обновлён — будет показан при следующем входе.'); }
      else { broadcast(null, { type: 'announce', text, channel: 'system' }); for (const w of new Set([...online.values()].map(o => o.worldId))) sysMsg(w, `ГМ-объявление: ${text}`, 'gm'); }
      audit(me.email, cmd, text, 'ok'); break;
    }
    case 'tp': {
      if (!needPerm('teleport')) break;
      const target = findOnline(sp[0]);
      if (!target) return say('Игрок не найден в онлайне.');
      if (sp[1] !== undefined && sp[2] !== undefined) { target.o.x = +sp[1] || 0; target.o.z = +sp[2] || 0; }
      else { target.o.x = me.x; target.o.z = me.z; }                    // телепорт к ГМ
      wsSend(target.sock, { type: 'gm_tp', x: target.o.x, z: target.o.z });
      broadcast(null, { type: 'move', id: target.sock.__id, x: target.o.x, z: target.o.z });
      say(`${target.o.name} перемещён → (${target.o.x.toFixed(1)}, ${target.o.z.toFixed(1)})`);
      audit(me.email, 'tp', sp.join(' '), 'ok'); break;
    }
    case 'kick': {
      if (!needPerm('kick')) break;
      const t = findOnline(sp[0]);
      if (!t) return say('Игрок не в сети.');
      const reason = sp.slice(1).join(' ') || 'без указания причины';
      wsSend(t.sock, { type: 'kicked', reason });
      setTimeout(() => t.sock.close(4000, 'kicked'), 150); online.delete(t.sock);
      broadcast(null, { type: 'chat', author: 'СИСТЕМА', text: `${t.o.name} выдворен ГМ ${me.name}: ${reason}`, channel: 'system', color: '#ff8a8a' });
      audit(me.email, 'kick', sp.join(' '), 'ok'); say('Готово.'); break;
    }
    case 'mute': {
      if (!needPerm('mute')) break;
      const secs = Math.max(5, Math.min(3600, parseInt(sp[1] || '300', 10)));
      muted.set(String(sp[0] || '').toLowerCase(), Date.now() + secs * 1000);
      say(`${sp[0]} заглушён на ${secs} c.`); audit(me.email, 'mute', sp.join(' '), `${secs}s`); break;
    }
    case 'unmute': {
      if (!needPerm('mute')) break;
      muted.delete(String(sp[0] || '').toLowerCase()); say('Заглушка снята.'); break;
    }
    case 'xp': {
      if (!needPerm('spawn_xp')) break;
      const t = findOnline(sp[0]); const amt = Math.max(0, parseInt(sp[1] || '0', 10));
      if (!t) return say('Игрок не в сети.');
      wsSend(t.sock, { type: 'gm_xp', amount: amt });
      say(`Начислено ${amt} опыта игроку ${t.o.name} (клиент применит при получении).`); audit(me.email, 'xp', sp.join(' '), 'sent'); break;
    }
    case 'world': {
      if (!needPerm('world_msg')) break;
      const w = sp.shift(); const text = sp.join(' ');
      for (const [sock, o] of online) if (o.worldId === w) wsSend(sock, { type: 'chat', author: 'ГМ-ВЕСТНИК', text, channel: 'global', color: '#ffd97a', gm: true });
      say(`Сообщение доставлено в мир ${w}.`); audit(me.email, 'world', `${w} ${text}`, 'ok'); break;
    }
    case 'ban': {
      if (!needPerm('ban')) break;
      const email = sp[0], mins = parseInt(sp[1] || '60', 10), reason = sp.slice(2).join(' ');
      if (!validEmail(email)) return say('Некорректный e-mail.');
      await banEmail(email, isNaN(mins) ? 60 : mins, reason, me.email);
      say(`${email} забанен${mins ? ` на ${mins} мин` : ' навсегда'}.`); audit(me.email, 'ban', sp.join(' '), 'ok'); break;
    }
    case 'unban': {
      if (!needPerm('ban')) break;
      await unbanEmail(sp[0] || ''); say('Бан снят.'); audit(me.email, 'unban', sp[0] || '', 'ok'); break;
    }
    case 'add_gm': case 'del_gm': {
      if (!needPerm('grant_gm')) break;
      try {
        if (cmd === 'add_gm') { await setGm(sp[0], Math.max(1, Math.min(3, parseInt(sp[1] || '2', 10)))); say(`${sp[0]} повышен до ГМ ур.${sp[1] || 2}.`); }
        else { await setGm(sp[0], 0); say(`ГМ-статус ${sp[0]} снят.`); }
        audit(me.email, cmd, sp.join(' '), 'ok');
      } catch (e) { say(e.message); }
      break;
    }
    case 'gmlist': {
      const g = await listGm();
      say(g.length ? g.map(x => `${x.email} (${x.title})`).join(', ') : 'ГМ-записей нет.'); break;
    }
    // ---- чат-системы: ГМ-управление каналами и рассылками ----
    case 'wmsg': {                                   // служебное ЛС от имени системы
      if (!needPerm('world_msg')) break;
      const to = sp.shift(); const text = sp.join(' ');
      if (!to || !text) return say('Формат: /gm wmsg <игрок> <текст>');
      if (!sendToPlayer(to, { type: 'chat', author: 'СИСТЕМА', text, channel: 'system', color: CHAN_COLORS.system, whisperish: true })) return say('Игрок не в сети.');
      say(`Системное сообщение доставлено: ${to}.`); audit(me.email, 'wmsg', `${to} ${text}`, 'ok'); break;
    }
    case 'sysmsg': {                                 // системная информация всем в мире ГМ
      if (!needPerm('world_msg')) break;
      const text = sp.join(' ');
      if (!text) return say('Пустой текст.');
      sysMsg(me.worldId, `ВЕДОМОСТЬ: ${text}`, 'gm');
      say(`Системная информация разослана в мир ${me.worldId}.`); audit(me.email, 'sysmsg', text, 'ok'); break;
    }
    case 'channels': {
      say(`Каналы: ${chatChannelsPublic().map(c => c.name).join(', ')} · ЛС-рейт: ${CFG.WHISPER_RATE}/с · вход/выход: ${CFG.SYS_JOIN_LEAVE ? 'вкл' : 'выкл'}`); break;
    }
    case 'chat': {                                   // /gm chat <global|local|party|whisper|system|gm> on|off
      if (!needPerm('motd')) break;
      const chMap = { global: 'CHAT_GLOBAL_ON', local: 'CHAT_LOCAL_ON', party: 'CHAT_PARTY_ON', whisper: 'CHAT_WHISPER_ON', system: 'CHAT_SYSTEM_ON', gm: 'CHAT_GM_ON' };
      const key = chMap[String(sp[0] || '').toLowerCase()];
      const on = /^(1|on|вкл|включить|да)$/i.test(sp[1] || '');
      const off = /^(0|off|выкл|выключить|нет)$/i.test(sp[1] || '');
      if (!key || (!on && !off)) return say('Формат: /gm chat <global|local|party|whisper|system|gm> <вкл|выкл>');
      await saveChatSetting(key, on ? '1' : '0');
      broadcast(null, { type: 'chat_settings', channels: chatChannelsPublic() });   // клиенты обновят вкладки
      say(`Канал «${sp[0]}» ${on ? 'включён' : 'отключён'} (сохранено в БД).`); audit(me.email, 'chat', sp.join(' '), 'ok'); break;
    }
    case 'inst': {
      if (!needPerm('manage')) break;
      const sub = (sp.shift() || 'list').toLowerCase();
      if (sub === 'list') say(INSTANCES_DEF.map(d => `${d.id} «${d.name}» ур.${d.levelMin}-${d.levelMax} ${d.diff} на ${d.size}`).join(' | '));
      else if (sub === 'open') {
        const r = instCreateRun({ name: me.name, worldId: me.worldId }, sp.shift() || 'inst_01', (sp.shift() || 'normal'), [me.name]);
        say(r.error || `Забег #${r.run.id} открыт: ${r.run.instId} (${r.run.diff}), lock ${r.lock.id}`);
      } else if (sub === 'locks') say(instLocks.length ? instLocks.map(l => `${l.id} ${l.instId}/${l.diff} лидер=${l.leaderName} ${l.completed ? 'готов' : 'активен'} ${Math.round((l.expiresAt - Date.now())/3600e3)}ч`).join(' | ') : 'Замков нет.');
      else if (sub === 'clear') { const i = instLocks.findIndex(l => l.id === sp[0]); if (i >= 0) { instLocks.splice(i, 1); say('Замок снят.'); } else say('Не найдено.'); }
      break;
    }
    case 'shutdown': {
      if (!needPerm('shutdown')) break;
      const s = Math.max(3, parseInt(sp[0] || '10', 10));
      broadcast(null, { type: 'chat', author: 'СИСТЕМА', text: `Сервер перезагружается через ${s} с.`, channel: 'system', color: '#ff8a8a' });
      audit(me.email, 'shutdown', `${s}s`, 'scheduled');
      setTimeout(() => process.exit(0), s * 1000); break;
    }
    default: say('Неизвестная команда. /gm help');
  }
}

// ------------------------------- старт -------------------------------------
// Авто-ГМ: аккаунты из GM_EMAILS (супер-владелец, ур.9) и GM2_EMAIL (ур.3) —
// если их нет в БД, создаются автоматически с паролями из .env.
async function ensureAutoGm() {
  const mk = [
    { email: process.env.GM_EMAIL || '', pass: process.env.GM_PASS || 'Gm!NightCraft1', level: 9, nick: process.env.GM_NICK || 'Хранитель Зари' },
    { email: process.env.GM2_EMAIL || '', pass: process.env.GM2_PASS || 'Gm!NightCraft2', level: 3, nick: process.env.GM2_NICK || 'Пепельный Вестник' },
  ].filter(x => validEmail(x.email));
  for (const g of mk) {
    let acc = await findAccount(g.email);
    if (!acc) {
      const salt = makeSalt(), hash = sha256(salt + ':' + g.pass);
      if (pool) {
        const r = await q('INSERT INTO accounts (email, nick, pass_hash, salt) VALUES (?,?,?,?)', [g.email, g.nick, hash, salt]);
        acc = { id: r.insertId, email: g.email, nick: g.nick };
      } else {
        acc = { id: nextAccId++, email: g.email, nick: g.nick, salt, pass_hash: hash, created_at: new Date() };
        mem.accounts.set(acc.email, acc);
      }
      log(`[gm] авто-создание ГМ-аккаунта: ${g.email}`);
    }
    memGm.set(String(acc.email).toLowerCase(), { level: g.level });
    if (pool) await q(`INSERT INTO gm_accounts (account_id, gm_level, perms, note) VALUES (?,?,?,?)
                       ON DUPLICATE KEY UPDATE gm_level=VALUES(gm_level), perms=VALUES(perms)`,
                      [acc.id, g.level, JSON.stringify(gmPermsForLevel(g.level)), 'deploy.php auto']).catch(()=>{});
    log(`[gm] ${acc.email} → ${GM_LEVELS[g.level]} (${gmPermsForLevel(g.level).length} прав)`);
  }
}

(async () => {
  await initDb();
  await loadGmTable();
  await ensureAutoGm();
  await loadChatSettings();
  server.listen(PORT, BIND_ADDR, () => {
    console.log('============================================================');
    console.log(`  Ночь Военного Ремесла — сервер: http://localhost:${PORT}`);
    console.log(`  Клиент с живой сетью: http://localhost:${PORT}/?api=http://localhost:${PORT}&server=ws://localhost:${PORT}${CFG.WS_PATH}`);
    console.log(`  База данных: ${NO_DB ? 'память (NO_DB=1)' : 'MySQL'} · WS-игра: ${CFG.WS_PATH} · онлайн: ${online.size}`);
    console.log(`  Рейты: tick=${CFG.TICK_MS}ms move=${CFG.MOVE_RATE_HZ}/s chat=${CFG.CHAT_RATE_PER_S}/s max=${CFG.MAX_PLAYERS_WS} hb=${CFG.HEARTBEAT_MS}ms`);
    console.log(`  Привязка: ${BIND_ADDR}:${PORT} (${CFG.PUBLIC_MODE ? 'ПУБЛИЧНЫЙ режим' : 'только localhost'}) · регистрация: ${CFG.ALLOW_REG ? 'открыта' : 'закрыта'}`);
    console.log('============================================================');
  });
})().catch((e) => { console.error('Старт не удался:', e.message); process.exit(1); });
