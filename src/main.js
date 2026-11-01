// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — точка входа:
//  аккаунт → выбор мира → фракция → архетип/роль/шаблон → игра
// ============================================================

import { Game } from './game/main.js';
import { GAME_TITLE, CLASSES, FACTIONS, ARCHETYPES, ROLES, ABILITIES, WORLDS, rolesForFaction } from './data/consts.js';
import { Auth } from './ui/auth.js';
import { deserialize } from './game/character.js';

const $ = (id) => document.getElementById(id);
document.title = GAME_TITLE;

const game = new Game($('gl'));
window.__nvrGame = game; // отладка из консоли

let account = null;                 // текущая учётная запись
let chosenWorld = null;             // id мира
let chosenFaction = null;           // id фракции
let chosenArch = null;              // id архетипа
let chosenRole = null;              // id роли-скелета
let chosenTemplate = 'ember';       // шаблон внешности

// --- Шаблоны персонажей (внешность + стартовый набор вида) ------------------
const TEMPLATES = [
  { id: 'ember',   name: 'Эмбер (кузнец-ветеран)', body: '#c9a06a', trim: '#e8a33d', desc: 'Обгоревший нагрудник, косынка от искр.' },
  { id: 'vex',     name: 'Векс (ночной странник)',  body: '#5a5f74', trim: '#9b7fd4', desc: 'Прожжённый плащ, лицо скрыто шарфом.' },
  { id: 'lyra',    name: 'Лира (егерша сумерека)',  body: '#7a8f6a', trim: '#6fcf97', desc: 'Костяные бусы, шкура ручной химеры.' },
  { id: 'kael',    name: 'Каэль (палач веры)',      body: '#8f8f96', trim: '#ffd76a', desc: 'Латунная маска с трещиной пополам.' },
  { id: 'mordren', name: 'Мордрен (инженер)',       body: '#7d6a55', trim: '#ff8a4a', desc: 'Ремень с инструментами, очки-консервы.' },
  { id: 'nyx',     name: 'Никс (химик)',            body: '#4f5a63', trim: '#7fe0c8', desc: 'Ранцы с реагентами, пробирки на поясе.' },
];

// --- Помощники экранов --------------------------------------------------------
function showScreen(id) {
  for (const s of ['screen-auth', 'screen-world', 'screen-faction', 'screen-create', 'screen-loading']) {
    $(s).classList.add('hidden');
  }
  $('screen-game').classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}
function setMsg(elId, text, ok) {
  const el = $(elId);
  el.textContent = text || '';
  el.classList.toggle('err', !!text && !ok);
  el.classList.toggle('ok', !!text && !!ok);
}

// =========================================================================
//  1. АВТОРИЗАЦИЯ
// =========================================================================
$('tab-login').addEventListener('click', () => switchAuthTab(true));
$('tab-register').addEventListener('click', () => switchAuthTab(false));
function switchAuthTab(login) {
  $('tab-login').classList.toggle('active', login);
  $('tab-register').classList.toggle('active', !login);
  $('form-login').classList.toggle('hidden', !login);
  $('form-register').classList.toggle('hidden', login);
}

$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    const acc = await Auth.login($('login-email').value.trim(), $('login-pass').value);
    enterAccount(acc, 'С возвращением во тьму.');
  } catch (e) { setMsg('auth-msg-login', e.message); }
});

$('form-register').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    if ($('reg-pass').value !== $('reg-pass2').value) throw new Error('Пароли не совпадают.');
    const acc = await Auth.register($('reg-email').value.trim(), $('reg-pass').value, $('reg-nick').value.trim());
    enterAccount(acc, 'Имя зажжено. Добро пожаловать в Эфирию.');
  } catch (e) { setMsg('auth-msg-register', e.message); }
});

$('btn-logout').addEventListener('click', (ev) => {
  ev.preventDefault();
  Auth.logout();
  account = null;
  showScreen('screen-auth');
});

function enterAccount(acc, helloMsg) {
  account = acc;
  renderWorldList();
  $('world-acc').textContent = `${acc.nick} <${acc.email}>`;
  setMsg('world-msg', helloMsg, true);
  showScreen('screen-world');
}

// =========================================================================
//  2. ВЫБОР МИРА
// =========================================================================
function renderWorldList() {
  const list = $('world-list');
  list.innerHTML = '';
  for (const w of Auth.worldList()) {
    const savedJson = account.characters[w.id];
    const savedChar = savedJson ? deserialize(savedJson) : null;
    const card = document.createElement('div');
    card.className = 'world-card' + (savedChar ? ' has-char' : '');
    card.dataset.wid = w.id;
    card.innerHTML = `
      <div class="wc-top"><b>${w.name}</b><span class="wc-tag ${w.pop === 'высокая' ? 'hot' : ''}">${w.pop}</span></div>
      <div class="wc-meta">пинг ~${w.ping} мс · игроков ~${w.players}</div>
      <div class="wc-desc">${w.desc}</div>
      <div class="wc-char">${savedChar
        ? `<span style="color:${FACTIONS[savedChar.faction]?.color || '#c8ccd8'}">◆ ${savedChar.name}</span>, ур. ${savedChar.level} — ${ARCHETYPES[savedChar.archetype]?.name || 'рекрут'}`
        : '<span class="wc-empty">персонаж не создан</span>'}</div>`;
    card.addEventListener('click', () => selectWorld(w.id));
    list.appendChild(card);
  }
  // автовыбор последнего мира
  selectWorld(account.lastWorld && WORLDS.some(w => w.id === account.lastWorld) ? account.lastWorld : Auth.worldList()[0].id);
}

function selectWorld(wid) {
  chosenWorld = wid;
  for (const c of document.querySelectorAll('.world-card')) c.classList.toggle('selected', c.dataset.wid === wid);
  const w = Auth.worldList().find(x => x.id === wid);
  const savedJson = account.characters[wid];
  const btn = $('btn-world-next');
  btn.disabled = false;
  if (savedJson) {
    const ch = deserialize(savedJson);
    btn.textContent = `▶ Войти за ${ch.name} (ур. ${ch.level})`;
    btn.dataset.mode = 'enter';
  } else {
    btn.textContent = 'Создать персонажа →';
    btn.dataset.mode = 'create';
  }
  setMsg('world-msg', w ? `Мир «${w.name}»: ${w.desc}` : '', true);
}

$('btn-world-next').addEventListener('click', () => {
  if (!chosenWorld) return;
  const savedJson = account.characters[chosenWorld];
  if (savedJson && $('btn-world-next').dataset.mode === 'enter') {
    bootWith(() => game.startRestored(deserialize(savedJson), { accountEmail: account.email, worldId: chosenWorld }),
      'Вспоминаем тебя, воин…');
  } else {
    renderFactions();
    showScreen('screen-faction');
  }
});

// =========================================================================
//  3. ФРАКЦИЯ
// =========================================================================
function renderFactions() {
  const wrap = $('faction-cards');
  wrap.innerHTML = '';
  for (const f of Auth.factionList()) {
    const card = document.createElement('div');
    card.className = 'faction-card';
    card.dataset.fid = f.id;
    card.style.setProperty('--fac-color', f.color);
    card.innerHTML = `
      <div class="fc-head"><span class="fc-icon">${f.icon}</span><b>${f.name}</b></div>
      <div class="fc-motto">«${f.motto}»</div>
      <div class="fc-desc">${f.desc}</div>
      <div class="fc-meta">Оплот: ${f.capital}<br>Стиль: ${f.style}</div>
      <div class="fc-arches">${Auth.archetypeList(f.id).map(a => a.name).join(' · ')}</div>`;
    card.addEventListener('click', () => selectFaction(f.id));
    wrap.appendChild(card);
  }
  $('btn-faction-next').disabled = true;
}
function selectFaction(fid) {
  chosenFaction = fid;
  for (const c of document.querySelectorAll('.faction-card')) c.classList.toggle('selected', c.dataset.fid === fid);
  $('btn-faction-next').disabled = false;
}
$('btn-faction-next').addEventListener('click', () => {
  if (!chosenFaction) return;
  renderCreateScreen();
  showScreen('screen-create');
});

// =========================================================================
//  4. СОЗДАНИЕ ПЕРСОНАЖА: архетип + роль + шаблон + имя
// =========================================================================
function renderCreateScreen() {
  const w = Auth.worldList().find(x => x.id === chosenWorld);
  $('create-world-tag').textContent = `· мир «${w ? w.name : '?'}» · ${FACTIONS[chosenFaction].short}`;
  // архетипы выбранной фракции
  const archWrap = $('arch-list');
  archWrap.innerHTML = '';
  for (const a of Auth.archetypeList(chosenFaction)) {
    const item = document.createElement('div');
    item.className = 'arch-item';
    item.dataset.aid = a.id;
    item.innerHTML = `<b>${a.name}</b><span>${a.tag}</span>`;
    item.addEventListener('click', () => selectArch(a.id));
    archWrap.appendChild(item);
  }
  // шаблоны
  const sel = $('tpl-select');
  sel.innerHTML = '';
  for (const t of TEMPLATES) {
    const o = document.createElement('option');
    o.value = t.id; o.textContent = t.name;
    sel.appendChild(o);
  }
  sel.value = chosenTemplate;
  sel.addEventListener('change', () => { chosenTemplate = sel.value; updateArchInfo(); });
  $('btn-tpl-random').addEventListener('click', () => {
    chosenTemplate = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)].id;
    sel.value = chosenTemplate;
    updateArchInfo();
  });
  $('hero-name').value = account.nick || '';
  chosenArch = null; chosenRole = null;
  $('btn-start').disabled = true;
  renderRoles();
  updateArchInfo();
}

function selectArch(aid) {
  chosenArch = aid;
  for (const c of document.querySelectorAll('.arch-item')) c.classList.toggle('selected', c.dataset.aid === aid);
  renderRoles();
  updateArchInfo();
}

function renderRoles() {
  const wrap = $('role-cards');
  wrap.innerHTML = '';
  const allowed = chosenArch ? [ARCHETYPES[chosenArch].role] : rolesForFaction(chosenFaction);
  for (const rid of Object.keys(ROLES)) {
    const r = ROLES[rid];
    const cls = CLASSES[rid];
    const locked = !allowed.includes(rid);
    const card = document.createElement('div');
    card.className = 'class-card' + (locked ? ' locked' : '') + (chosenRole === rid ? ' selected' : '');
    card.dataset.rid = rid;
    card.innerHTML = `
      <div class="cc-avatar" style="--cls-color:${cls.color}; --tpl-body:${templateColor('body')}; --tpl-trim:${templateColor('trim')}"></div>
      <div class="cc-name">${r.name}${locked ? ' 🔒' : ''}</div>
      <div class="cc-tag">${r.tag}</div>
      <div class="cc-stats">HP ${cls.base.hp} · Мог ${cls.base.might} · Маг ${cls.base.arcane} · Лов ${cls.base.agility}</div>`;
    if (!locked) card.addEventListener('click', () => { chosenRole = rid; renderRoles(); validateStart(); });
    wrap.appendChild(card);
  }
  if (allowed.length === 1 && !allowed.includes(chosenRole)) chosenRole = allowed[0];
  // подсветить обязательную роль
  for (const c of document.querySelectorAll('.class-card')) {
    if (!locked && c.dataset.rid === chosenRole) c.classList.add('selected');
  }
  validateStart();
}

function templateColor(key) {
  const t = TEMPLATES.find(x => x.id === chosenTemplate) || TEMPLATES[0];
  return t[key];
}

function updateArchInfo() {
  const info = $('arch-info');
  const a = chosenArch && ARCHETYPES[chosenArch];
  if (!a) {
    info.innerHTML = `<i>Выберите архетип — он задаёт стиль боя и умения гильдии.</i>`;
  } else {
    const abil = a.arch.map(id => ABILITIES[id]).filter(Boolean).map(ab => ab.name).join(', ');
    info.innerHTML = `
      <div class="ai-name" style="color:${FACTIONS[a.faction].color}">${a.name}</div>
      <div class="ai-desc">${a.desc}</div>
      <div class="ai-bonus">✦ Пассивка: ${a.bonus.text}</div>
      <div class="ai-abil">Умения: ${abil}</div>
      <div class="ai-tpl">Шаблон: ${(TEMPLATES.find(t => t.id === chosenTemplate) || {}).desc || ''}</div>`;
  }
  validateStart();
}
function validateStart() {
  const nameOk = /^[\wА-Яа-яЁё\-]{2,20}$/.test($('hero-name').value.trim());
  $('btn-start').disabled = !(chosenArch && chosenRole && nameOk);
}
$('hero-name').addEventListener('input', validateStart);

$('btn-start').addEventListener('click', () => {
  const name = ($('hero-name').value.trim() || 'Безымянный').slice(0, 20);
  bootWith(() => game.start(name, chosenRole, {
    accountEmail: account.email,
    worldId: chosenWorld,
    faction: chosenFaction,
    archetype: chosenArch,
  }), 'Разжигаем горн…');
});

// =========================================================================
//  ЗАГРУЗКА ИГРЫ
// =========================================================================
function showGame() {
  showScreen(null);
  $('screen-game').classList.remove('hidden');
}
async function bootWith(fn, loadText) {
  $('loading-text').textContent = loadText || 'Разжигаем горн…';
  $('screen-loading').classList.remove('hidden');
  await new Promise(r => setTimeout(r, 80));   // кадр на отрисовку лоадера
  try {
    await fn();
    hideLoading();
    showGame();
  } catch (e) {
    console.error(e);
    hideLoading();
    $('loading-text').textContent = 'Застава не открылась: ' + e.message;
    setTimeout(() => showScreen('screen-world'), 1600);
  }
}
function hideLoading() { $('screen-loading').classList.add('hidden'); }

$('btn-respawn')?.addEventListener('click', () => game.respawn());

// Выход из игры в меню (pause-menu)
window.__nvrQuitToMenu = () => {
  game.save();
  location.reload();
};

// Флейвор «MMO»: счётчик игроков в меню
let online = 137;
setInterval(() => {
  online = Math.max(40, Math.min(400, online + Math.floor(Math.random() * 5) - 2));
  const el = $('menu-online');
  if (el && !$('screen-auth').classList.contains('hidden')) el.textContent = `Игроков в мире сейчас: ${online}`;
}, 3000);

// =========================================================================
//  СТАРТ: есть сессия?
// =========================================================================
const sess = Auth.session();
if (sess) { enterAccount(sess, 'Сессия восстановлена.'); }
else { showScreen('screen-auth'); }
