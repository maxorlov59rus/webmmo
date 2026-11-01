import * as m from '../src/data/consts.js';
console.log('ALL_QUESTS', m.ALL_QUESTS.length);
console.log('q_g100:', JSON.stringify(m.questByIdG('q_g100')?.name));
console.log('gilda quests:', m.questsForNpcG('gilda').length);
console.log('gate npcs:', Object.keys(m.INST_GATE_NPCS||{}).length);
const bad = m.ALL_QUESTS.filter(q=>!m.LOCATIONS[q.loc]); console.log('bad locs:', bad.length);
