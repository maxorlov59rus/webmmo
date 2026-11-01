// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — точка входа
// ============================================================

import { Game } from './game/main.js';
import { GAME_TITLE } from './data/consts.js';

const $ = (id) => document.getElementById(id);

document.title = GAME_TITLE;
$('title-main').textContent = 'НОЧЬ';
$('title-sub').textContent = 'ВОЕННОГО РЕМЕСЛА';

const game = new Game($('gl'));
window.__nvrGame = game; // отладка из консоли

function showGame() {
  $('screen-create').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
}
function hideLoading() { $('screen-loading').classList.add('hidden'); }

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
  }
}

// Есть сохранение?
const saved = Game.loadSaved();
if (saved) {
  $('continue-row').classList.remove('hidden');
  $('btn-continue').addEventListener('click', () =>
    bootWith(() => game.startRestored(saved), 'Вспоминаем тебя, воин…'));
}

$('btn-start').addEventListener('click', () => {
  const name = ($('hero-name').value.trim() || 'Безымянный').slice(0, 20);
  const cls = window.__selectedClass;
  if (!cls) return;
  bootWith(() => game.start(name, cls));
});

$('btn-respawn')?.addEventListener('click', () => game.respawn());

// Флейвор «MMO»: счётчик игроков в меню
let online = 137;
setInterval(() => {
  online = Math.max(40, Math.min(400, online + Math.floor(Math.random() * 5) - 2));
  const el = $('menu-online');
  if (el) el.textContent = `Игроков в мире сейчас: ${online}`;
}, 3000);
