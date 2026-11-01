// Экспорт игрового контента для наполнения БД (используется сервером и установщиком deploy.php)
// node tools/export_content.mjs  ->  server/content_export.json
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __ = path.dirname(fileURLToPath(import.meta.url));
const m = await import(path.join(__, '../src/data/consts.js'));
const inst = await import(path.join(__, '../src/data/instances.js'));
const out = {
  factions: m.FACTIONS || null, classes: m.CLASSES, locations: m.LOCATIONS, mobs: m.MOBS,
  items: m.ITEMS, npcs: m.NPCS, dialogs: m.DIALOGS, quests: m.QUESTS,
  allQuests: m.ALL_QUESTS,          // 17 ручных + 352 генерированных = 369
  recipes: m.RECIPES, abilities: m.ABILITIES, instances: inst.INSTANCES,
};
writeFileSync(path.join(__, '../server/content_export.json'), JSON.stringify(out));
console.log('exported:', Object.fromEntries(Object.entries(out).map(([k,v])=>[k,(Array.isArray(v)?v.length:Object.keys(v||{}).length)])));
