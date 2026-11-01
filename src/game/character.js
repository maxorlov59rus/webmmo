// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — состояние персонажа: характеристики,
//  уровни, экипировка, инвентарь, способности, квесты.
// ============================================================

import * as THREE from '../../vendor/three.module.js';
import { CLASSES, ITEMS, ABILITIES, STAT_KEYS } from '../data/consts.js';

export function xpForLevel(level) { return Math.round(80 * Math.pow(level, 1.55)); }

export function createCharacter(name, classId, seed = Date.now()) {
  const cls = CLASSES[classId];
  const c = {
    name, classId, level: 1, xp: 0, statPoints: 0, gold: 15,
    base: { ...cls.base },
    allocated: { might: 0, ward: 0, arcane: 0, agility: 0, wit: 0 },
    hp: cls.base.hp, mp: cls.base.mp,
    equipment: { weapon: null, body: null, trinket: null },
    inventory: [],          // [{id, qty}]
    cooldowns: {},          // abilityId -> время готовности (сек игровые)
    buffs: [],              // {type, ratio, until}
    quests: [],             // [{id, step, progress}]
    kills: {},              // mobId -> count
    createdAt: seed,
  };
  for (const id of cls.startKit) addItem(c, id, 1);
  autoEquipBest(c);
  recalc(c);
  c.hp = c.stats.maxHp; c.mp = c.stats.maxMp;
  return c;
}

// --- Инвентарь ---------------------------------------------------------------
export function addItem(c, id, qty = 1) {
  const def = ITEMS[id]; if (!def) return false;
  if (def.stack) {
    const slot = c.inventory.find(s => s.id === id);
    if (slot) { slot.qty += qty; return true; }
  }
  for (let i = 0; i < qty; i++) c.inventory.push({ id, qty: 1 });
  return true;
}
export function removeItem(c, id, qty = 1) {
  let left = qty;
  for (let i = c.inventory.length - 1; i >= 0 && left > 0; i--) {
    const s = c.inventory[i];
    if (s.id !== id) continue;
    const take = Math.min(left, s.qty);
    s.qty -= take; left -= take;
    if (s.qty <= 0) c.inventory.splice(i, 1);
  }
  return left === 0;
}
export function countItem(c, id) {
  return c.inventory.filter(s => s.id === id).reduce((a, s) => a + s.qty, 0);
}
export function equip(c, invIndex) {
  const slot = c.inventory[invIndex]; if (!slot) return;
  const def = ITEMS[slot.id]; if (!def || def.slot === 'none') return;
  const prev = c.equipment[def.slot];
  c.equipment[def.slot] = slot.id;
  c.inventory.splice(invIndex, 1);
  if (prev) c.inventory.push({ id: prev, qty: 1 });
  recalc(c);
}
export function unequip(c, slotName) {
  const cur = c.equipment[slotName]; if (!cur) return;
  c.equipment[slotName] = null;
  c.inventory.push({ id: cur, qty: 1 });
  recalc(c);
}
export function useConsumable(c, invIndex, game) {
  const slot = c.inventory[invIndex]; if (!slot) return;
  const def = ITEMS[slot.id];
  if (!def || !def.use) return;
  if (def.use.type === 'heal') {
    if (c.stats && c.hp >= c.stats.maxHp) return;
    c.hp = Math.min(c.stats.maxHp, c.hp + def.use.value);
    if (game) game.fx.floatText(c.pos || new THREE.Vector3(0, 1, 0), '+' + def.use.value, '#5ad05a');
  } else if (def.use.type === 'mana') {
    c.mp = Math.min(c.stats.maxMp, c.mp + def.use.value);
  }
  removeItem(c, slot.id, 1);
}

function autoEquipBest(c) {
  for (const id of [...c.inventory].map(s => s.id)) {
    const def = ITEMS[id];
    if (!def || def.slot === 'none') continue;
    const cur = c.equipment[def.slot];
    const score = (iid) => iid ? ((ITEMS[iid].rarity || 0) * 10 + (ITEMS[iid].dmg ? sum(ITEMS[iid].dmg) : 0) + (ITEMS[iid].armor ? sum(ITEMS[iid].armor) : 0)) : -1;
    if (score(id) > score(cur)) {
      const idx = c.inventory.findIndex(s => s.id === id);
      if (idx >= 0) equip(c, idx);
    }
  }
}
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// --- Пересчёт характеристик ---------------------------------------------------
export function recalc(c) {
  const cls = CLASSES[c.classId];
  const lvl = c.level - 1;
  const stats = {};
  for (const k of STAT_KEYS) {
    stats[k] = Math.floor(cls.base[k] + cls.growth[k] * lvl + c.allocated[k]);
  }
  let bonusHp = 0, bonusMp = 0, bonusCrit = 0, dmgMin = 0, dmgMax = 0, armorMin = 0, armorMax = 0, reach = 1.2, speedMul = 1;
  const passives = { blockBonus: 0, speedBonus: 0, xpBonus: 0 };
  for (const slotId of Object.values(c.equipment)) {
    if (!slotId) continue;
    const it = ITEMS[slotId]; if (!it) continue;
    if (it.mods) {
      for (const [k, v] of Object.entries(it.mods)) {
        if (k === 'hp') bonusHp += v;
        else if (k === 'mp') bonusMp += v;
        else if (k === 'crit') bonusCrit += v;
        else if (STAT_KEYS.includes(k)) stats[k] += v;
      }
    }
    if (it.dmg) { dmgMin = Math.max(dmgMin, it.dmg[0]); dmgMax = Math.max(dmgMax, it.dmg[1]); if (it.reach) reach = it.reach; }
    if (it.armor) { armorMin += it.armor[0]; armorMax += it.armor[1]; }
    if (it.speed) speedMul *= it.speed;
  }
  // пассивные способности
  for (const ab of knownAbilities(c)) {
    if (ab.kind !== 'passive' || !ab.effect) continue;
    if (ab.effect.type === 'blockBonus') passives.blockBonus += ab.effect.value;
    if (ab.effect.type === 'speedBonus') passives.speedBonus += ab.effect.value;
    if (ab.effect.type === 'xpBonus') passives.xpBonus += 2;
  }
  const maxHp = Math.round(cls.base.hp + cls.growth.hp * lvl + bonusHp + stats.ward * 2);
  const maxMp = Math.round(cls.base.mp + cls.growth.mp * lvl + bonusMp + stats.arcane * 4);
  const dmgBase = (dmgMin + dmgMax) / 2 + stats.might * 1.1;
  const magBase = 6 + stats.arcane * 1.6;
  c.stats = {
    ...stats,
    maxHp, maxMp,
    dmgBase, magBase,
    crit: 5 + stats.agility * 0.7 + bonusCrit,
    block: 5 + stats.ward * 0.8,
    armor: [armorMin, armorMax],
    reach, speedMul,
    moveSpeed: 4.4 + stats.agility * 0.12,
    passives,
    shieldRatio: (c.buffs.find(b => b.type === 'shield') || {}).ratio || 0,
  };
  c.hp = Math.min(c.hp, maxHp); c.mp = Math.min(c.mp, maxMp);
  return c.stats;
}

export function knownAbilities(c) {
  const list = [];
  for (const ab of Object.values(ABILITIES)) {
    if (ab.class !== c.classId && ab.class !== 'all') continue;
    if (ab.level <= c.level) list.push(ab);
  }
  return list.sort((a, b) => a.level - b.level);
}

export function gainXp(c, amount, game) {
  const mult = 1 + (c.stats.passives.xpBonus / 100);
  c.xp += Math.round(amount * mult);
  let leveled = false;
  while (c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level++; c.statPoints += 3;
    leveled = true;
    if (game) game.onLevelUp(c);
  }
  recalc(c);
  if (leveled) { c.hp = c.stats.maxHp; c.mp = c.stats.maxMp; }
  return leveled;
}

export function allocateStat(c, key) {
  if (c.statPoints <= 0) return false;
  c.allocated[key]++; c.statPoints--;
  recalc(c);
  return true;
}

// --- Сохранение ---------------------------------------------------------------
export function serialize(c) {
  return JSON.stringify({
    name: c.name, classId: c.classId, level: c.level, xp: c.xp, statPoints: c.statPoints, gold: c.gold,
    base: c.base, allocated: c.allocated, hp: c.hp, mp: c.mp,
    equipment: c.equipment, inventory: c.inventory, quests: c.quests, kills: c.kills,
  });
}
export function deserialize(json) {
  try {
    const d = JSON.parse(json);
    const c = createCharacter(d.name, d.classId);
    Object.assign(c, {
      level: d.level, xp: d.xp, statPoints: d.statPoints, gold: d.gold,
      allocated: d.allocated, equipment: d.equipment, inventory: d.inventory,
      quests: d.quests || [], kills: d.kills || {},
    });
    recalc(c);
    c.hp = Math.min(d.hp ?? c.stats.maxHp, c.stats.maxHp);
    c.mp = Math.min(d.mp ?? c.stats.maxMp, c.stats.maxMp);
    return c;
  } catch (e) { console.warn('save corrupt', e); return null; }
}
