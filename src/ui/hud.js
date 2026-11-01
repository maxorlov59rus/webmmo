// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — HUD и панели (оверлеи поверх WebGL)
//  Все ID согласованы с index.html; класс-скелет: warden/mage/scout,
//  сверх этого — фракция и архетип из auth-потока.
// ============================================================

import { ITEMS, CLASSES, RARITY_NAMES, RARITY_COLORS, STATS, STAT_KEYS, FACTIONS, ARCHETYPES, locationAt } from '../data/consts.js';
import { xpForLevel } from '../game/character.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// иконки способностей по ключевым словам типа
function abilityIcon(ab) {
  if (ab.icon) return ab.icon;
  const k = (ab.kind || '') + ' ' + (ab.id || '');
  if (k.includes('heal') || k.includes('жар')) return '✚';
  if (k.includes('shield') || k.includes('bastion')) return '⛨';
  if (k.includes('bolt') || k.includes('spark') || k.includes('nova')) return '✦';
  if (k.includes('cleave') || k.includes('whirl')) return '⚔';
  if (k.includes('shot') || k.includes('arrow') || k.includes('volley')) return '➶';
  if (k.includes('step') || k.includes('dash')) return '⇝';
  if (k.includes('dot') || k.includes('poison') || k.includes('burn')) return '☠';
  return '◆';
}

export class UI {
  constructor(game) {
    this.game = game;
    this.activePanel = null;
    this._slotSig = '';
    this._bind();
  }

  _bind() {
    // кнопки панелей в меню паузы и хоткеи живут в game/main.js;
    // здесь — закрытие панелей, чат, лут, меню игры.
    document.querySelectorAll('.panel-close').forEach(b => {
      b.addEventListener('click', () => this.closePanels());
    });

    // чат: Enter открывает/отправляет
    const input = $('chat-input');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = input.value.trim();
        if (v) this.game.sendChat(v);
        input.value = '';
        input.blur();
      }
      if (e.key === 'Escape') input.blur();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement !== input && !this.game.dialogOpen) {
        e.preventDefault(); input.focus();
      }
      if (e.key === 'Escape') { this.closePanels(); this.closeGameMenu(); }
    });

    // трекер заданий: свернуть/развернуть
    $('quest-tracker').addEventListener('click', () => {
      $('qt-list').classList.toggle('hidden');
    });

    // лут: «Забрать всё» просто сворачивает попап (лут уже в сумке)
    $('loot-take').addEventListener('click', () => $('loot-popup').classList.add('hidden'));

    // меню игры (пауза)
    $('btn-menu-open').addEventListener('click', () => this.openGameMenu());
    $('btn-gm-close').addEventListener('click', () => this.closeGameMenu());
    $('btn-gm-save').addEventListener('click', () => {
      this.game.save();
      this.toast('Ночь запомнила тебя.', '#8fd18f');
    });
    $('btn-gm-quit').addEventListener('click', () => {
      if (window.__nvrQuitToMenu) window.__nvrQuitToMenu();
    });
  }

  openGameMenu() {
    this.game.paused = true;
    const c = this.game.char;
    const fac = c && c.faction ? FACTIONS[c.faction] : null;
    const arch = c && c.archetype ? ARCHETYPES[c.archetype] : null;
    $('gm-info').innerHTML = c ? `
      <b style="color:var(--gold)">${esc(c.name)}</b> · ур. ${c.level}<br>
      ${fac ? `<span style="color:${fac.color}">${fac.icon} ${esc(fac.name)}</span><br>` : ''}
      ${arch ? esc(arch.name) + '<br>' : ''}
      мир: ${esc((this.game.worldId || '').toUpperCase())} · сохранение автоматическое` : '';
    $('game-menu').classList.remove('hidden');
  }
  closeGameMenu() {
    $('game-menu').classList.add('hidden');
    this.game.paused = false;
  }

  // --- Панели -----------------------------------------------------------------
  togglePanel(name) {
    if (this.activePanel === name) { this.closePanels(); return; }
    this.closePanels();
    this.activePanel = name;
    const el = $('panel-' + name);
    if (el) { el.classList.remove('hidden'); this.refreshPanel(name); }
  }
  closePanels() {
    this.activePanel = null;
    document.querySelectorAll('[data-panel]').forEach(p => p.classList.add('hidden'));
  }
  refreshPanel(name) {
    if (name === 'inventory') this.renderInventory();
    if (name === 'character') this.renderCharacter();
    if (name === 'craft') this.renderCraft();
    if (name === 'quests') this.renderQuests();
    if (name === 'instances') this.renderInstances();
  }

  // ---------------- ИНСТАНСЫ: визуализация в клиенте ------------------------
  renderInstances() {
    const g = this.game;
    const list = document.getElementById('inst-list'); if (!list) return;
    const q = (document.getElementById('inst-search') || {}).value || '';
    const df = (document.getElementById('inst-diff') || {}).value || '';
    const sz = (document.getElementById('inst-size') || {}).value || '';
    const items = INSTANCES.filter(i => (!q || i.name.toLowerCase().includes(q.toLowerCase())) && (!df || i.diff === df) && (!sz || String(i.size) === sz));
    list.innerHTML = items.map(i => {
      const d = DIFFICULTY[i.diff];
      const lock = g.inst.run && g.inst.run.def.id === i.id;
      const lvlOk = g.char.level >= i.levelMin;
      const fmt = i.size === 1 ? 'СОЛО' : i.size === 5 ? 'ГРУППА ×5' : 'РЕЙД ×10';
      return `<div class="inst-card" style="border:1px solid #333;border-radius:6px;padding:8px;margin:6px 0;background:#151220">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <b style="color:${d.color}">${i.num}. ${i.name}</b><span style="font-size:11px;color:#9aa">${fmt} · ур.${i.levelMin}–${i.levelMax}</span></div>
        <div style="font-size:12px;color:#aab;margin:4px 0">${i.desc}</div>
        <div style="font-size:11px;color:#889">Волн: ${i.waves} · Босс: ${(MOBS[i.boss]||{name:i.boss}).name} · Таймер: ${i.timerMin} мин${i.keyReq ? ' · Нужен ключ: ' + i.keyReq : ''}</div>
        <div style="font-size:11px;color:#ffd24a;margin:4px 0">Награда: ${i.rewards.xp} опыта, ${i.rewards.gold} зол. · Лут: ${i.rewards.loot.map(x=>(ITEMS[x]||{name:x}).name).join(', ')}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          ${['normal','heroic','mythic'].map(dd=>`<button data-inst="${i.id}" data-diff="${dd}" ${lvlOk?'':'disabled title="Нужен ур. '+i.levelMin+'"'} style="background:${dd===i.diff?DIFFICULTY[dd].color:'#222'};color:#0b0b12;font-weight:600;border:none;border-radius:4px;padding:4px 8px;cursor:pointer">${DIFFICULTY[dd].name}</button>`).join('')}
          ${lock?'<span style="color:#c07ff0;font-size:11px;align-self:center">◈ активный забег</span>':''}
        </div></div>`;
    }).join('') || '<div style="color:#889">Нет зон под фильтр.</div>';
    list.querySelectorAll('button[data-inst]').forEach(b => b.onclick = () => {
      if (g.inst.run) { this.toast('Сначала выйди из текущего инстанса.', '#e88'); return; }
      g.inst.enter(b.dataset.inst, b.dataset.diff);
    });
    ['inst-search','inst-diff','inst-size'].forEach(id => { const el=document.getElementById(id); if(el&&!el.__b){el.__b=1; el.addEventListener('input',()=>this.renderInstances());} });
    this.renderInstanceHud();
  }
  renderInstanceHud() {
    const g = this.game, el = document.getElementById('inst-hud'); if (!el) return;
    const run = g.inst.run;
    if (!run) { el.classList.add('hidden'); el.innerHTML=''; return; }
    el.classList.remove('hidden');
    const left = Math.max(0, Math.round(run.endsAt - g.time));
    const mm = Math.floor(left/60), ss = String(left%60).padStart(2,'0');
    el.innerHTML = `<div style="border:1px solid #c07ff0;border-radius:6px;padding:8px;margin:6px 0;background:#1c1430">
      <b style="color:#c07ff0">⚔ ${run.def.name}</b> <span style="color:#9aa">(${DIFFICULTY[run.diff].name}, ×${run.mult})</span>
      <div style="font-size:12px;color:#ccd;margin-top:4px">Волна ${run.wave+1}/${run.total} · Осталось мобов: ${run.mobsLeft} · ⏱ ${mm}:${ss}</div>
      <div style="font-size:11px;color:#8fd18f;margin-top:2px">Отряд: ${run.party.join(', ')}${g.inst.bots.length?' (боты)':''} · Lock ID: ${run.lockId}</div>
      <button id="inst-exit" style="margin-top:6px;background:#3a2030;color:#ff9a9a;border:1px solid #a05;border-radius:4px;padding:3px 10px;cursor:pointer">Выйти из зоны</button></div>`;
    const ex = document.getElementById('inst-exit'); if (ex) ex.onclick = () => g.inst.finish(false);
  }

  // --- Верхний HUD -------------------------------------------------------------
  updateHud() {
    const g = this.game, c = g.char;
    if (!c) return;
    $('bar-hp').style.width = (100 * c.hp / c.stats.maxHp) + '%';
    $('txt-hp').textContent = `${Math.ceil(c.hp)}/${c.stats.maxHp}`;
    $('bar-mp').style.width = (100 * c.mp / c.stats.maxMp) + '%';
    $('txt-mp').textContent = `${Math.floor(c.mp)}/${c.stats.maxMp}`;
    $('bar-xp').style.width = (100 * c.xp / xpForLevel(c.level)) + '%';
    $('txt-xp').textContent = `${c.xp}/${xpForLevel(c.level)}`;
    $('hud-name').textContent = c.name;
    $('hud-level').textContent = c.level;
    const fac = c.faction ? FACTIONS[c.faction] : null;
    const arch = c.archetype ? ARCHETYPES[c.archetype] : null;
    $('hud-faction').textContent = fac ? `· ${fac.icon} ${fac.short}${arch ? ' · ' + arch.name : ''}` : '';
    $('portrait').textContent = (c.name || '?')[0].toUpperCase();
    $('portrait').style.borderColor = CLASSES[c.classId].color;

    // локация и время суток
    const p = g.playerParts ? g.playerParts.root.position : null;
    const zone = p ? locationAt(p.x, p.z) : null;
    const zt = $('zone-time');
    if (zt) {
      const phase = g.dayNight === 'dawn' ? 'Рассвет' : 'Ночь';
      zt.textContent = (zone ? zone.name : 'Эфирия') + ' · ' + phase;
    }
    const mm = document.querySelector('.mm-label');
    if (mm && zone) mm.textContent = zone.name;

    // цель
    const t = g.target;
    if (t && !t.dead) {
      $('target-frame').classList.remove('hidden');
      $('target-name').textContent = `${t.name} · ур.${t.level}`;
      $('bar-target').style.width = (100 * Math.max(0, t.hp) / t.maxHp) + '%';
    } else {
      $('target-frame').classList.add('hidden');
    }

    // подсказка взаимодействия [F]
    const interact = g.nearNpc || g.nearInteract;
    let hint = $('interact-hint');
    if (interact) {
      if (!hint) {
        hint = document.createElement('div');
        hint.id = 'interact-hint';
        hint.className = 'hint-pill';
        $('screen-game').appendChild(hint);
      }
      hint.textContent = `[F] ${interact.label}`;
    } else if (hint) hint.remove();

    // миникарта
    this.drawMinimap();
  }

  drawMinimap() {
    const cv = $('minimap-canvas');
    if (!cv || !this.game.char) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, R = 46; // радиус мира в метрах
    const c = this.game.char, g = this.game;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10,14,22,0.9)';
    ctx.fillRect(0, 0, W, H);
    const px = (x) => W / 2 + (x - c.pos.x) / R * (W / 2);
    const pz = (z) => H / 2 + (z - c.pos.z) / R * (H / 2);
    // кузница
    ctx.fillStyle = '#ff8a3c';
    ctx.beginPath(); ctx.arc(px(6), pz(-4), 3.5, 0, 7); ctx.fill();
    // NPC — жёлтым
    for (const n of g.npcs) {
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(px(n.parts.root.position.x) - 2, pz(n.parts.root.position.z) - 2, 4, 4);
    }
    // мобы — красным, босс крупнее
    for (const m of g.mobs) {
      if (m.dead || !m.mesh) continue;
      ctx.fillStyle = m.def.boss ? '#c07ff0' : '#d05040';
      const s = m.def.boss ? 5 : 2.5;
      ctx.fillRect(px(m.pos.x) - s / 2, pz(m.pos.z) - s / 2, s, s);
    }
    // другие игроки — голубым
    for (const rp of g.remotePlayers.values()) {
      if (!rp.mesh) continue;
      ctx.fillStyle = '#7aa0ff';
      ctx.fillRect(px(rp.mesh.position.x) - 2, pz(rp.mesh.position.z) - 2, 4, 4);
    }
    // игрок — белая стрелка
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-(g.playerParts ? g.playerParts.root.rotation.y : 0));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // --- Инвентарь -----------------------------------------------------------------
  renderInventory() {
    const c = this.game.char;
    const body = $('inv-body');
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'inv-layout';
    // экипировка
    const eq = document.createElement('div');
    eq.className = 'equip-col';
    for (const slot of ['weapon', 'body', 'trinket']) {
      const id = c.equipment[slot];
      const def = id ? ITEMS[id] : null;
      const d = document.createElement('div');
      d.className = 'equip-slot';
      d.innerHTML = `<div class="slot-label">${slotName(slot)}</div>` +
        (def ? `<div class="item-name" style="color:${RARITY_COLORS[def.rarity]}">${esc(def.name)}</div>` : '<div class="slot-empty">— пусто —</div>');
      if (def) d.title = itemTooltip(def) + '\n\nКлик: снять';
      if (def) d.addEventListener('click', () => {
        import('../game/character.js').then(({ unequip }) => { unequip(c, slot); this.renderInventory(); this.updateHud(); });
      });
      eq.appendChild(d);
    }
    wrap.appendChild(eq);
    // сумка
    const invWrap = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    if (!c.inventory.length) grid.innerHTML = '<div class="inv-empty">Сумка пуста. Химеры щедрее на трофеи, чем казна.</div>';
    c.inventory.forEach((s, i) => {
      const def = ITEMS[s.id]; if (!def) return;
      const d = document.createElement('div');
      d.className = 'inv-item';
      d.style.borderColor = RARITY_COLORS[def.rarity];
      d.innerHTML = `<span class="item-name" style="color:${RARITY_COLORS[def.rarity]}">${esc(def.name)}</span>` +
        (s.qty > 1 ? `<span class="iqty">×${s.qty}</span>` : '');
      d.title = itemTooltip(def) + '\n\nКлик: использовать/надеть';
      d.addEventListener('click', () => this.game.useOrEquipFromInventory(i));
      grid.appendChild(d);
    });
    invWrap.appendChild(grid);
    const foot = document.createElement('div');
    foot.className = 'inv-foot';
    foot.textContent = `Монеты: ${c.gold} зол.`;
    invWrap.appendChild(foot);
    wrap.appendChild(invWrap);
    body.appendChild(wrap);
  }

  // --- Персонаж -------------------------------------------------------------------
  renderCharacter() {
    const c = this.game.char;
    const cls = CLASSES[c.classId];
    const fac = c.faction ? FACTIONS[c.faction] : null;
    const arch = c.archetype ? ARCHETYPES[c.archetype] : null;
    const body = $('char-body');
    body.innerHTML = '';

    const head = document.createElement('div');
    head.id = 'char-detail';
    head.innerHTML = `
      <div class="cd-name" style="color:${cls.color}">${esc(c.name)}</div>
      <div class="cd-sub">${arch ? esc(arch.name) : esc(cls.name)} · ${fac ? esc(fac.name) : 'без знамени'} · ур. ${c.level}</div>
      <div class="cd-xp">Опыт: ${c.xp} / ${xpForLevel(c.level)}</div>
      <div class="cd-points ${c.statPoints ? '' : 'dim'}">Свободных очков: <b>${c.statPoints}</b></div>`;
    body.appendChild(head);

    const list = document.createElement('div');
    list.id = 'stat-list';
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
    body.appendChild(list);

    const s = c.stats;
    const der = document.createElement('div');
    der.className = 'derived';
    der.innerHTML = `
      <div>Урон: ${(s.dmgBase * 0.85 | 0)}–${(s.dmgBase * 1.15 | 0)}</div>
      <div>Магия: ${s.magBase | 0}</div>
      <div>Крит: ${(s.crit || 0).toFixed(0)}%</div>
      <div>Блок: ${Math.min(40, (s.block || 0) + ((s.passives && s.passives.blockBonus) || 0)).toFixed(0)}%</div>
      <div>Броня: ${s.armor ? s.armor[0] : 0}–${s.armor ? s.armor[1] : 0}</div>
      <div>Скорость: ${(s.moveSpeed || 5).toFixed(1)}</div>`;
    body.appendChild(der);

    // способности архетипа/класса
    const spTitle = document.createElement('div');
    spTitle.className = 'sub-title'; spTitle.textContent = 'Боевой набор';
    body.appendChild(spTitle);
    const spList = document.createElement('div');
    spList.id = 'spell-list';
    let hi = 0;
    for (const ab of this.game.knownAbilities()) {
      const hotkey = ab.kind === 'active' ? String(++hi <= 5 ? hi : 'Q') : '✧';
      const d = document.createElement('div');
      d.className = 'spell-row' + (ab.kind === 'passive' ? ' passive' : '');
      d.innerHTML = `<div class="spell-key">${hotkey}</div>
        <div class="spell-main"><b>${esc(ab.name)}</b> <span class="spell-lvl">ур.${ab.level || 1}</span>
        <div class="spell-desc">${esc(ab.desc)}</div></div>
        <div class="spell-cost">${ab.cost && ab.cost.mp ? ab.cost.mp + ' маны' : '—'}</div>`;
      spList.appendChild(d);
    }
    body.appendChild(spList);
  }

  // --- Квесты ----------------------------------------------------------------------
  renderQuests() {
    const c = this.game.char;
    // трекер (виден всегда)
    const tr = $('qt-list');
    if (tr) {
      tr.innerHTML = '';
      for (const q of c.quests) {
        const def = this.game.questDef(q.id);
        if (!def) continue;
        const step = def.steps[q.step];
        if (!step) continue;
        const div = document.createElement('div');
        div.className = 'q-entry';
        div.innerHTML = `<div class="q-name" style="color:${def.color}">✦ ${esc(def.name)}</div>
          <div class="q-step">${esc(step.text)} (${q.progress}/${step.count || 1})</div>`;
        tr.appendChild(div);
      }
      if (!c.quests.length) tr.innerHTML = '<div class="q-none">Нет активных заданий. Поговори с жителями заставы [F].</div>';
    }
    // панель журнала
    if (this.activePanel === 'quests') {
      const pn = $('quests-body');
      pn.innerHTML = '';
      for (const q of c.quests) {
        const def = this.game.questDef(q.id);
        if (!def) continue;
        const div = document.createElement('div');
        div.className = 'q-full';
        div.innerHTML = `<b style="color:${def.color}">${esc(def.name)}</b><br>
          ${def.steps.map((st, i) => `<div class="${i < q.step ? 'done' : ''}">${i < q.step ? '✔ ' + esc(st.text) : i === q.step ? '☐ ' + esc(st.text) + ` (${q.progress}/${st.count || 1})` : '· ' + esc(st.text)}</div>`).join('')}
          <div class="q-reward">Награда: ${def.reward.xp} опыта, ${def.reward.gold} зол.${def.reward.items && def.reward.items.length ? ', ' + def.reward.items.map(i => esc((ITEMS[i] || {}).name || i)).join(', ') : ''}</div>`;
        pn.appendChild(div);
      }
      if (!pn.children.length) pn.innerHTML = '<p>Активных заданий нет.</p>';
    }
  }

  // --- Крафт (панель + тот же рендер, что был у кузницы) ----------------------------
  renderCraft() {
    const g = this.game, c = g.char;
    const body = $('craft-body');
    body.innerHTML = '';
    const mats = document.createElement('div');
    mats.className = 'craft-mats';
    mats.innerHTML = ['iron_ore', 'moonstone'].map(id =>
      `<span>${esc(ITEMS[id].name)}: <b>${g.countItem(id)}</b></span>`).join(' ');
    body.appendChild(mats);

    const list = document.createElement('div');
    list.id = 'recipe-list';
    let any = false;
    for (const r of g.recipesAvailable()) {
      any = true;
      const out = ITEMS[r.out];
      const can = g.canCraft(r);
      const d = document.createElement('div');
      d.className = 'recipe' + (can ? '' : ' disabled');
      d.innerHTML = `<div><div class="r-name" style="color:${RARITY_COLORS[out.rarity]}">${esc(out.name)}</div>
          <div class="r-lvl">требуется ур. ${r.reqLevel}</div></div>
        <div class="r-mats">${Object.entries(r.mats).map(([m, n]) => {
          const have = g.countItem(m);
          return `<span class="${have >= n ? 'ok' : 'no'}">${esc(ITEMS[m].name)} ${have}/${n}</span>`;
        }).join(' · ')}</div>
        <button class="craft-btn" ${can ? '' : 'disabled'}>Выковать</button>`;
      d.querySelector('.craft-btn').addEventListener('click', () => { g.startCraft(r); this.renderCraft(); });
      list.appendChild(d);
    }
    if (!any) list.innerHTML = '<p>Горн Дормира молчит: заданий кузнеца пока нет.</p>';
    body.appendChild(list);
    const note = document.createElement('div');
    note.className = 'craft-note';
    note.textContent = 'Руду и лунный камень носят курганы и химеры. Горн заставы (F у наковальни) кует быстрее рук.';
    body.appendChild(note);
  }
  showForge() { this.togglePanel('craft'); }
  hideForge() { if (this.activePanel === 'craft') this.closePanels(); }

  // --- Диалог NPC ---------------------------------------------------------------------
  showDialog(npc, options) {
    const d = $('dialog-frame');
    d.classList.remove('hidden');
    $('dlg-portrait').textContent = (npc.name || '?')[0];
    $('dlg-name').textContent = npc.name + (npc.role ? ' · ' + npc.role : '');
    $('dlg-text').textContent = options.intro || '';
    const box = $('dlg-options');
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
  closeDialog() { $('dialog-frame').classList.add('hidden'); this.game.dialogOpen = false; }

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
    $('loot-items').innerHTML = items.length
      ? items.map(it => `<div class="loot-line" style="color:${RARITY_COLORS[it.rarity || 0]}">${esc(it.name)}</div>`).join('')
      : '<div class="loot-line dim">пусто</div>';
    const lp = $('loot-popup');
    lp.classList.remove('hidden');
    clearTimeout(this._lootT);
    this._lootT = setTimeout(() => lp.classList.add('hidden'), 2400);
  }

  // --- Экшен-бар -------------------------------------------------------------------------
  updateCooldownBar() {
    const bar = $('skill-slots');
    const g = this.game;
    if (!g.char) return;
    const acts = g.knownAbilities().filter(a => a.kind === 'active').slice(0, 6);
    const sig = acts.map(a => a.id).join('|');
    if (sig !== this._slotSig) {
      this._slotSig = sig;
      bar.innerHTML = '';
      acts.forEach((ab, i) => {
        const cell = document.createElement('div');
        cell.className = 'skill-slot';
        cell.innerHTML = `<span class="ss-key">${i + 1 <= 5 ? i + 1 : 'Q'}</span>
          <span class="ss-icon">${abilityIcon(ab)}</span>
          <span class="ss-name">${esc(ab.name)}</span>
          ${ab.cost && ab.cost.mp ? `<span class="ss-cost">${ab.cost.mp}</span>` : ''}
          <div class="ss-cd"></div>`;
        cell.title = ab.desc;
        cell.addEventListener('click', () => g.castAbility(ab.id));
        bar.appendChild(cell);
      });
    }
    acts.forEach((ab, i) => {
      const cell = bar.children[i];
      const cdEl = cell.querySelector('.ss-cd');
      const ready = g.isAbilityReady(ab.id);
      const manaOk = g.char.mp >= ((ab.cost && ab.cost.mp) || 0);
      cell.classList.toggle('ready', ready && manaOk);
      cell.classList.toggle('nomana', !manaOk);
      if (!ready) {
        const left = g.cooldownLeft(ab.id);
        cdEl.style.height = (100 * left / (ab.cd || 1)) + '%';
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
