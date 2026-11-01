// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — клиентская часть auth-потока.
//  Пароли в браузере не хранятся: хэш (SHA-256) + соль.
//  На реальном сервере (server/server.js) — та же схема и тот же
//  контракт сообщений; этот модуль работает как offline-фолбэк.
// ============================================================

import { WORLDS, FACTIONS, ARCHETYPES, archetypesForFaction } from '../data/consts.js';
import { defaultAccount, saveAccount, loadAccount, accountExists, rememberSession, getSession, clearSession } from '../game/character.js';

const API_URL = (() => {
  const p = new URLSearchParams(location.search);
  return p.get('api') || null;               // ?api=http://host:3000 — реальный сервер
})();

export function sha256(text) {
  if (crypto && crypto.subtle) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      .then(buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''));
  }
  // детерминированный fallback (если WebCrypto недоступен — http на старых браузерах)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return Promise.resolve((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16));
}

const salt = () => Math.random().toString(36).slice(2, 12);

// ---- «Сервер» в localStorage (оффлайн-режим) ------------------------------
async function localRegister(email, password, nick) {
  if (accountExists(email)) throw new Error('Такая учётная запись уже существует.');
  const s = salt();
  const hash = await sha256(s + ':' + password);
  const acc = defaultAccount(email, nick);
  acc.salt = s; acc.hash = hash;
  saveAccount(acc);
  return acc;
}
async function localLogin(email, password) {
  const acc = loadAccount(email);
  if (!acc) throw new Error('Учётная запись не найдена — зарегистрируйтесь.');
  const hash = await sha256(acc.salt + ':' + password);
  if (hash !== acc.hash) throw new Error('Неверный пароль.');
  return acc;
}

// ---- Реальный HTTP-сервер (если задан ?api=) -------------------------------
async function api(path, body) {
  const r = await fetch(API_URL + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('Ошибка сервера ' + r.status));
  return data;
}

export const Auth = {
  online: !!API_URL,

  async register(email, password, nick) {
    this._validate(email, password, nick);
    const acc = API_URL
      ? await api('/api/register', { email, password, nick })
      : await localRegister(email, password, nick);
    rememberSession(acc.email);
    return acc;
  },

  async login(email, password) {
    if (!/.+@.+\..+/.test(email)) throw new Error('Введите корректный e-mail.');
    if (!password) throw new Error('Введите пароль.');
    const acc = API_URL
      ? await api('/api/login', { email, password })
      : await localLogin(email, password);
    rememberSession(acc.email);
    return acc;
  },

  logout() { clearSession(); },

  session() {
    const email = getSession();
    return email ? loadAccount(email) : null;
  },

  worldList() {
    // демографический флейвор: popularity/ping берём из конфига миров
    return WORLDS.map(w => ({ ...w, players: 40 + (w.seed % 160) }));
  },

  factionList() { return Object.values(FACTIONS); },
  archetypeList(factionId) { return archetypesForFaction(factionId).map(k => ARCHETYPES[k]); },

  _validate(email, password, nick) {
    if (!/.+@.+\..+/.test(email)) throw new Error('E-mail выглядит неполным.');
    if ((password || '').length < 6) throw new Error('Пароль — минимум 6 символов.');
    if (!/^[\wА-Яа-яЁё \-]{2,16}$/.test((nick || '').trim())) throw new Error('Ник: 2–16 букв/цифр/пробелов.');
  },
};
