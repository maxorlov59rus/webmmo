// Полный граф импортов (включая three.js и модули, использующие document — сам импорт не должен падать)
try {
  await import('./src/game/world.js');
  await import('./src/game/models.js');
  await import('./src/game/combat.js');
  await import('./src/ui/hud.js');
  await import('./src/ui/auth.js');
  await import('./src/game/main.js');
  await import('./src/main.js').catch(e => { throw e; });
  console.log('FULL IMPORT GRAPH OK');
} catch (e) {
  console.error('IMPORT FAIL:', e.message);
  process.exit(1);
}
