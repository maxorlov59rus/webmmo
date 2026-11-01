// Проверка графа импортов без WebGL-контекста (three.module.js на уровне модуля не создаёт контекст)
try {
  await import('./src/data/consts.js');
  await import('./src/data/appearance.js');
  await import('./src/game/character.js');
  await import('./src/game/net.js');
  console.log('IMPORT GRAPH OK (data+character+net)');
} catch (e) {
  console.error('IMPORT FAIL:', e.message);
  process.exit(1);
}
