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
  PUBLIC_MODE:    process.env.PUBLIC_MODE === '1',
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
  worlds: [
    { id: 'nwm-1', name: 'Первый Костёр', seed: 20261102, pop: 'высокая' },
    { id: 'nwm-2', name: 'Люминитовый Разлом', seed: 770211, pop: 'средняя' },
    { id: 'nwm-3', name: 'Пепел Аэрии', seed: 411007, pop: 'низкая' },
    { id: 'nwm-4', name: 'Сумеречная Роща', seed: 902113, pop: 'высокая' },
  ],
};
let nextAccId = 1, nextCharId = 1;

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
    if (pool) await q('UPDATE accounts SET last_login = NOW() WHERE id = ?', [acc.id]);
    res.json(accountPayload(acc));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера.' }); }
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
  ws.on('message', (buf) => {
    ws.__lastMsg = Date.now();
    if (!buckets.any.take()) return;                 // грубый флуд — тихо режем
    let m; try { m = JSON.parse(buf.toString()); } catch (_) { return; }
    switch (m.type) {
      case 'hello': {
        if (me) return;                              // повторный hello игнорируем
        me = { name: String(m.name || 'Странник').slice(0, 16), worldId: m.world || 'nwm-1', x: 0, z: 0, level: m.level || 1, cls: m.cls || 'warden' };
        online.set(ws, me);
        // шлём всем уже присутствующим о новичке
        broadcast(null, { type: 'spawn', entity: { id: ws.__id || (ws.__id = crypto.randomUUID()), kind: 'player', name: me.name, cls: me.cls, color: '#d9a441', level: me.level, x: me.x, z: me.z, worldId: me.worldId } }, true);
        // и новичку — про всех остальных
        for (const [sock, o] of online) {
          if (sock === ws) continue;
          wsSend(ws, { type: 'spawn', entity: { id: sock.__id, kind: 'player', name: o.name, cls: o.cls, color: '#d9a441', level: o.level, x: o.x, z: o.z } });
        }
        wsSend(ws, { type: 'welcome', id: ws.__id, motd: 'Добро пожаловать в Эфирию. Свет — твоё оружие, тьма — твой враг.' });
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
        const text = String(m.text || '').slice(0, 200);
        if (!text) return;
        broadcast(null, { type: 'chat', author: me.name, text, channel: m.channel || 'global', color: '#cfe3ff' });
        if (pool) q('INSERT INTO chat_log (world_id, author, channel, text) VALUES (?,?,?,?)', [me.worldId, me.name, m.channel || 'global', text]).catch(() => {});
        else mem.chat.push({ world_id: me.worldId, author: me.name, channel: m.channel || 'global', text, ts: new Date() });
        break;
      }
      case 'emote': {
        if (!me) return;
        broadcast(ws, { type: 'emote', id: ws.__id, name: String(m.name || 'поклон').slice(0, 16) });
        break;
      }
      case 'ping': wsSend(ws, { type: 'pong', t: m.t }); break;
      default: break;
    }
  });
  ws.on('close', () => {
    if (me) broadcast(null, { type: 'despawn', id: ws.__id });
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

// ------------------------------- старт -------------------------------------
(async () => {
  await initDb();
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
