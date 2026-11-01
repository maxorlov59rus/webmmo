// Смоук-тест: импорт всех модулей в jsdom-подобной заглушке невозможна без DOM,
// поэтому проверяем только чистую логику (consts/character) + синтаксис остальных.
import { CLASSES, ITEMS, ABILITIES, QUESTS, RECIPES, MOBS, NPCS } from './src/data/consts.js';
import { createCharacter, recalc, gainXp, addItem, equip, serialize, deserialize, xpForLevel } from './src/game/character.js';

// character.js импортирует THREE — в node это ок (three.module.js не требует DOM при импорте)
for (const cls of Object.values(CLASSES)) {
  const c = createCharacter('Тест', cls.id);
  if (!c.stats || !Number.isFinite(c.stats.maxHp)) throw new Error('bad stats ' + cls.id);
  addItem(c, 'iron_ore', 5); addItem(c, 'moonstone', 3);
  gainXp(c, 10000);
  if (c.level < 2) throw new Error('xp fail');
  const json = serialize(c);
  const d = deserialize(json);
  if (!d || d.level !== c.level) throw new Error('serialize fail');
}
// квесты: все ссылки валидны
for (const q of QUESTS) for (const st of q.steps) {
  if (st.item && !ITEMS[st.item]) throw new Error('bad item ' + st.item);
  if (st.mob && !MOBS[st.mob]) throw new Error('bad mob ' + st.mob);
  if (st.npc && !NPCS[st.npc]) throw new Error('bad npc ' + st.npc);
  if (q.reward.items) for (const i of q.reward.items) if (!ITEMS[i]) throw new Error('bad reward ' + i);
}
for (const r of RECIPES) { if (!ITEMS[r.out]) throw new Error('bad recipe out'); for (const m of Object.keys(r.mats)) if (!ITEMS[m]) throw new Error('bad mat'); }
for (const ab of Object.values(ABILITIES)) { if (ab.class !== 'all' && !CLASSES[ab.class]) throw new Error('bad ability class'); }
for (const m of Object.values(MOBS)) for (const [iid] of m.loot) if (!ITEMS[iid]) throw new Error('bad loot ' + iid);
console.log('SMOKE OK · уровней до 20 нужно опыта:', xpForLevel(20));
