// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — HUD и панели (оверлеи поверх WebGL)
// ============================================================

import { ITEMS, CLASSES, RARITY_NAMES, RARITY_COLORS, STATS, STAT_KEYS, ABILITIES } from '../data/consts.js';
import { xpForLevel } from '../game/character.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.activePanel = null;
    this.chatHistory = [];
    this._bind();
  }

  _bind() {
    // переключение панелей
    document.querySelectorAll('[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => this.togglePanel(btn.dataset.panel));
    });
    document.querySelectorAll('.panel-close').forEach(b => {
      b.addEventListener('click', () => this.closePanels());
    });
    // чат
    const input = $('chat-input');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = input.value.trim();
        if (v) this.game.sendChat(v);
        input.value = '';
        input.blur();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement !== input) {
        e.preventDefault(); input.focus();
      }
      if (e.key === 'Escape') { this.closePanels(); input.blur(); }
    });
    // квест-трекер кликабелен для сворачивания
    $('quest-tracker').addEventListener('click', () => {
      $('quest-tracker-body').classList.toggle('hidden');
    });
  }

  togglePanel(name) {
    const panels = ['inventory', 'character', 'spells', 'quests', 'help'];
    if (this.activePanel === name) { this.closePanels(); return; }
    this.closePanels();
    this.activePanel = name;
    const el = $('panel-' + name);
    if (el) { el.classList.add('open'); this.refreshPanel(name); }
  }
  closePanels() {
    this.activePanel = null;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  }
  refreshPanel(name) {
    if (name === 'inventory') this.renderInventory();
    if (name === 'character') this.renderCharacter();
    if (name === 'spells') this.renderSpells();
    if (name === 'quests') this.renderQuests();
  }

  // --- Верхний HUD -------------------------------------------------------------
  updateHud() {
    const g = this.game, c = g.char;
    if (!c) return;
    $('hp-fill').style.width = (100 * c.hp / c.stats.maxHp) + '%';
    $('hp-text').textContent = `${Math.ceil(c.hp)}/${c.stats.maxHp}`;
    $('mp-fill').style.width = (100 * c.mp / c.stats.maxMp) + '%';
    $('mp-text').textContent = `${Math.floor(c.mp)}/${c.stats.maxMp}`;
    $('xp-fill').style.width = (100 * c.xp / xpForLevel(c.level)) + '%';
    $('level-badge').textContent = c.level;
    $('char-name-hud').textContent = c.name;
    $('gold-count').textContent = c.gold;
    // портрет-класс
    const cls = CLASSES[c.classId];
    $('portrait').style.borderColor = cls.color;
    // бафф щита
    $('buff-shield').classList.toggle('hidden', !c.buffs.some(b => b.type === 'shield'));
    // цель
    const t = g.target;
    if (t && !t.dead) {
      $('target-frame').classList.remove('hidden');
      $('target-name').textContent = `${t.name} · ур.${t.level}`;
      $('target-hp-fill').style.width = (100 * t.hp / t.maxHp) + '%';
    } else {
      $('target-frame').classList.add('hidden');
    }
    // мини-статы на рейд-баре кузницы если рядом
    const nearForge = Math.hypot(c.pos.x - 6, c.pos.z - (-4)) < 5;
    $('forge-hint').classList.toggle('hidden', !nearForge);
    const interact = g.nearNpc || g.nearInteract;
    $('interact-hint').classList.toggle('hidden', !interact);
    if (interact) $('interact-hint').textContent = `[F] ${interact.label}`;
  }

  // --- Экран создания персонажа --------------------------------------------------
  showCreateScreen() {
    $('screen-create').classList.remove('hidden');
    $('screen-game').classList.add('hidden');
    this._classCards();
  }
  hideCreateScreen() {
    $('screen-create').classList.add('hidden');
    $('screen-game').classList.remove('hidden');
  }
  _classCards() {
    const wrap = $('class-cards');
    wrap.innerHTML = '';
    for (const cls of Object.values(CLASSES)) {
      const card = document.createElement('div');
      card.className = 'class-card'; card.dataset.cls = cls.id;
      card.style.setProperty('--cls-color', cls.color);
      card.innerHTML = `
        <h3>${esc(cls.name)}</h3>
        <div class="tag">${esc(cls.tag)}</div>
        <p>${esc(cls.desc)}</p>
        <ul class="statlist">
          ${STAT_KEYS.map(k => `<li><span>${STATS[k].short}</span><b>${cls.base[k]}</b></li>`).join('')}
          <li><span>HP</span><b>${cls.base.hp}</b></li>
          <li><span>MP</span><b>${cls.base.mp}</b></li>
        </ul>`;
      card.addEventListener('click', () => {
        document.querySelectorAll('.class-card').forEach(x => x.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedClass = cls.id;
        window.__selectedClass = cls.id;
        $('btn-start').disabled = !$('hero-name').value.trim() || !this.selectedClass;
      });
      wrap.appendChild(card);
    }
    $('hero-name').addEventListener('input', () => {
      $('btn-start').disabled = !$('hero-name').value.trim() || !this.selectedClass;
    });
  }

  // --- Инвентарь -----------------------------------------------------------------
  renderInventory() {
    const c = this.game.char;
    const eq = $('equip-slots');
    eq.innerHTML = '';
    for (const slot of ['weapon', 'body', 'trinket']) {
      const id = c.equipment[slot];
      const def = id ? ITEMS[id] : null;
      const d = document.createElement('div');
      d.className = 'equip-slot';
      d.innerHTML = `<div class="slot-label">${slotName(slot)}</div>` +
        (def ? `<div class="item-name" style="color:${RARITY_COLORS[def.rarity]}">${esc(def.name)}</div>` : '<div class="slot-empty">— пусто —</div>');
      if (def) d.addEventListener('click', () => { window.__unequipSlot(slot); });
      eq.appendChild(d);
    }
    const inv = $('inv-grid');
    inv.innerHTML = '';
    c.inventory.forEach((s, i) => {
      const def = ITEMS[s.id]; if (!def) return;
      const d = document.createElement('div');
      d.className = 'inv-item';
      d.style.borderColor = RARITY_COLORS[def.rarity];
      d.innerHTML = `<span class="iname" style="color:${RARITY_COLORS[def.rarity]}">${esc(def.name)}</span>` +
        (s.qty > 1 ? `<span class="iqty">×${s.qty}</span>` : '');
      d.title = itemTooltip(def);
      d.addEventListener('dblclick', () => this.game.useOrEquipFromInventory(i));
      d.addEventListener('click', () => this.game.useOrEquipFromInventory(i));
      inv.appendChild(d);
    });
    $('inv-gold').textContent = c.gold + ' зол.';
  }

  // --- Персонаж -------------------------------------------------------------------
  renderCharacter() {
    const c = this.game.char;
    const cls = CLASSES[c.classId];
    $('char-detail').innerHTML = `
      <div class="cd-name" style="color:${cls.color}">${esc(c.name)}</div>
      <div class="cd-sub">${esc(cls.name)} · уровень ${c.level}</div>
      <div class="cd-xp">Опыт: ${c.xp} / ${xpForLevel(c.level)}</div>
      <div class="cd-points ${c.statPoints ? '' : 'dim'}">Свободных очков: <b>${c.statPoints}</b></div>`;
    const list = $('stat-list');
    list.innerHTML = '';
    for (const k of STAT_KEYS) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span class="sname">${STATS[k].name}</span>
        <span class="sval">${c.stats[k]}</span>
        <button class="plus" ${c.statPoints ? '' : 'disabled'}>+</button>`;
      row.querySelector('.plus').addEventListener('click', () => {
        this.game.allocateStat(k); this.renderCharacter(); this.updateHud();
      });
      row.title = STATS[k].desc;
      list.appendChild(row);
    }
    const s = c.stats;
    $('derived-stats').innerHTML = `
      <div>Урон: ${(s.dmgBase * 0.85 | 0)}–${(s.dmgBase * 1.15 | 0)}</div>
      <div>Магия: ${s.magBase | 0}</div>
      <div>Крит: ${s.crit.toFixed(0)}%</div>
      <div>Блок: ${Math.min(40, s.block + s.passives.blockBonus).toFixed(0)}%</div>
      <div>Броня: ${s.armor[0]}–${s.armor[1]}</div>
      <div>Скорость: ${s.moveSpeed.toFixed(1)}</div>`;
  }

  // --- Способности ------------------------------------------------------------------
  renderSpells() {
    const c = this.game.char;
    const list = $('spell-list');
    list.innerHTML = '';
    const acts = this.game.knownAbilities().filter(a => a.kind === 'active');
    let hi = 0;
    for (const ab of this.game.knownAbilities()) {
      const hotkey = ab.kind === 'active' ? (hi < 5 ? ++hi : 'Q') : '';
      if (ab.kind === 'active' && hi > 5) hotkey; // noop
      const d = document.createElement('div');
      d.className = 'spell-row' + (ab.kind === 'passive' ? ' passive' : '');
      d.innerHTML = `<div class="spell-key">${hotkey}</div>
        <div class="spell-main"><b>${esc(ab.name)}</b> <span class="spell-lvl">ур.${ab.level}</span>
        <div class="spell-desc">${esc(ab.desc)}</div></div>
        <div class="spell-cost">${ab.cost.mp ? ab.cost.mp + ' маны' : '—'}</div>`;
      list.appendChild(d);
    }
  }

  // --- Квесты ------------------------------------------------------------------------
  renderQuests() {
    const c = this.game.char;
    // трекер
    const tr = $('quest-log');
    tr.innerHTML = '';
    for (const q of c.quests) {
      const def = this.game.questDef(q.id);
      if (!def) continue;
      const step = def.steps[q.step];
      const div = document.createElement('div');
      div.className = 'q-entry';
      div.innerHTML = `<div class="q-name" style="color:${def.color}">✦ ${esc(def.name)}</div>
        <div class="q-step">${esc(step.text)} (${q.progress}/${step.count || 1})</div>`;
      tr.appendChild(div);
    }
    if (!c.quests.length) tr.innerHTML = '<div class="q-none">Нет активных заданий. Поговори с жителями заставы [F].</div>';
    // панель
    if (this.activePanel === 'quests') {
      const pn = $('panel-quests-body');
      pn.innerHTML = '';
      for (const q of c.quests) {
        const def = this.game.questDef(q.id);
        const div = document.createElement('div');
        div.className = 'q-full';
        div.innerHTML = `<b style="color:${def.color}">${esc(def.name)}</b><br>
          ${def.steps.map((st, i) => `<div class="${i < q.step ? 'done' : ''}">${i <= q.step ? '☐ ' + esc(st.text) + (i === q.step ? ` (${q.progress}/${st.count || 1})` : '') : '✔ ' + esc(st.text)}</div>`).join('')}
          <div class="q-reward">Награда: ${def.reward.xp} опыта, ${def.reward.gold} зол.${def.reward.items?.length ? ', ' + def.reward.items.map(i => esc(ITEMS[i]?.name || i)).join(', ') : ''}</div>`;
        pn.appendChild(div);
      }
      if (!pn.children.length) pn.innerHTML = '<p>Активных заданий нет.</p>';
    }
  }

  // --- Диалог NPC ---------------------------------------------------------------------
  showDialog(npc, options) {
    const d = $('dialog');
    d.classList.remove('hidden');
    $('dialog-npc-name').textContent = npc.name;
    $('dialog-role').textContent = npc.role || '';
    $('dialog-text').textContent = options.intro || '';
    const box = $('dialog-options');
    box.innerHTML = '';
    (options.actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'dialog-btn' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      b.addEventListener('click', () => a.onClick(this));
      box.appendChild(b);
    });
    const close = document.createElement('button');
    close.className = 'dialog-btn';
    close.textContent = 'Закрыть';
    close.addEventListener('click', () => this.closeDialog());
    box.appendChild(close);
  }
  closeDialog() { $('dialog').classList.add('hidden'); this.game.dialogOpen = false; }

  // --- Кузница -------------------------------------------------------------------------
  showForge() {
    $('forge').classList.remove('hidden');
    this.renderForge();
  }
  hideForge() { $('forge').classList.add('hidden'); }
  renderForge() {
    const g = this.game, c = g.char;
    const list = $('recipe-list');
    list.innerHTML = '';
    for (const r of g.recipesAvailable()) {
      const out = ITEMS[r.out];
      const can = g.canCraft(r);
      const d = document.createElement('div');
      d.className = 'recipe' + (can ? '' : ' disabled');
      d.innerHTML = `<div class="r-name" style="color:${RARITY_COLORS[out.rarity]}">${esc(out.name)}</div>
        <div class="r-mats">${Object.entries(r.mats).map(([m, n]) => {
          const have = g.countItem(m);
          return `<span class="${have >= n ? 'ok' : 'no'}">${esc(ITEMS[m].name)} ${have}/${n}</span>`;
        }).join(' · ')}</div>
        <button class="craft-btn" ${can ? '' : 'disabled'}>Выковать</button>`;
      d.querySelector('.craft-btn').addEventListener('click', () => g.startCraft(r));
      list.appendChild(d);
    }
    $('forge-mats').innerHTML = ['iron_ore', 'moonstone'].map(id =>
      `<span>${esc(ITEMS[id].name)}: <b>${g.countItem(id)}</b></span>`).join(' ');
  }

  // --- Чат ------------------------------------------------------------------------------
  addChat(text, colorCss, prefix) {
    const log = $('chat-log');
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = (prefix ? `<span class="chat-prefix">${esc(prefix)}</span> ` : '') +
      `<span style="color:${colorCss || '#cfd6e4'}">${esc(text)}</span>`;
    log.appendChild(line);
    while (log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  toast(text, colorCss) {
    const t = document.createElement('div');
    t.className = 'toast'; t.style.color = colorCss || '#ffd98a';
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, 2600);
  }
  lootPopup(items) {
    const lp = $('loot-popup');
    lp.innerHTML = items.map(it => `<div class="loot-line" style="color:${RARITY_COLORS[it.rarity]}">${esc(it.name)}</div>`).join('') || '<div class="loot-line dim">пусто</div>';
    lp.classList.add('show');
    clearTimeout(this._lootT);
    this._lootT = setTimeout(() => lp.classList.remove('show'), 1800);
  }

  updateCooldownBar() {
    const bar = $('action-bar');
    const g = this.game;
    if (!g.char) return;
    const acts = g.knownAbilities().filter(a => a.kind === 'active').slice(0, 6);
    if (bar.childElementCount !== acts.length) {
      bar.innerHTML = '';
      acts.forEach((ab, i) => {
        const cell = document.createElement('div');
        cell.className = 'ability-cell';
        cell.innerHTML = `<span class="ab-key">${i + 1 <= 5 ? i + 1 : 'Q'}</span><span class="ab-name">${esc(ab.name)}</span><div class="ab-cd"></div>`;
        cell.title = ab.desc;
        cell.addEventListener('click', () => g.castAbility(ab.id));
        bar.appendChild(cell);
      });
    }
    acts.forEach((ab, i) => {
      const cell = bar.children[i];
      const cdEl = cell.querySelector('.ab-cd');
      const ready = g.isAbilityReady(ab.id);
      cell.classList.toggle('ready', ready);
      if (!ready) {
        const total = ab.cd;
        const left = g.cooldownLeft(ab.id);
        cdEl.style.height = (100 * left / total) + '%';
        cdEl.textContent = left.toFixed(1);
      } else { cdEl.style.height = '0%'; cdEl.textContent = ''; }
    });
  }

  showDeath() { $('death-overlay').classList.remove('hidden'); }
  hideDeath() { $('death-overlay').classList.add('hidden'); }
}

function slotName(s) { return { weapon: 'Оружие', body: 'Доспех', trinket: 'Амуниция' }[s] || s; }

export function itemTooltip(def) {
  let t = `${def.name} [${RARITY_NAMES[def.rarity || 0]}]`;
  if (def.dmg) t += `\nУрон: ${def.dmg[0]}–${def.dmg[1]}`;
  if (def.reach) t += `\nДосяжность: +${def.reach}`;
  if (def.armor) t += `\nБроня: ${def.armor[0]}–${def.armor[1]}`;
  if (def.mods) t += '\n' + Object.entries(def.mods).map(([k, v]) => {
    const nm = { might: 'Могущество', ward: 'Защита', arcane: 'Магия', agility: 'Ловкость', wit: 'Догадка', hp: 'Здоровье', mp: 'Мана', crit: 'Крит (%)' }[k] || k;
    return `${v > 0 ? '+' : ''}${v} ${nm}`;
  }).join('\n');
  if (def.use) t += `\nИспользование: ${def.use.type === 'heal' ? 'лечит ' + def.use.value : 'маны +' + def.use.value}`;
  if (def.lore) t += `\n\n«${def.lore}»`;
  return t;
}
