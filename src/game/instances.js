// ============================================================
//  ИНСТАНСЫ — клиентская механика зон (соло с ботами / с игроками)
//  Сервер: inst.list / inst.create / inst.kill / inst.leave (server.js)
// ============================================================
import * as THREE from '../../vendor/three.module.js';
import { heightAt } from './world.js';
import { buildHumanoid, AnimController, makeLabel } from './models.js';
import { gainXp, addItem } from './character.js';
import { MOBS, ITEMS } from '../data/consts.js';
import { INSTANCES, DIFFICULTY, instanceById } from '../data/instances.js';

const BOT_NAMES = ['Эйра Тихая','Гром Каменный','Ведьма Кира','Лунный Волк','Искра','Зима','Ратобор','Странник'];
const BOT_ROLES = [
  { name: 'Страж', hpMul: 1.5, dmgMul: 0.8, color: 0x6fa8d0 },
  { name: 'Убийца', hpMul: 0.9, dmgMul: 1.4, color: 0xc07ff0 },
  { name: 'Целитель', hpMul: 1.0, dmgMul: 0.7, color: 0x6fcf97 },
];

export class InstanceManager {
  constructor(game) {
    this.game = game;
    this.run = null;            // активный забег
    this.groupMobs = [];        // мобы инстанса
    this.bots = [];             // отряд ботов
    this.sceneGroup = null;
    this.timerHandle = null;
  }

  list() { return INSTANCES; }
  availableFor(level) { return INSTANCES.filter(i => level >= i.levelMin - 2); }

  // --- вход -------------------------------------------------------------------
  enter(instId, diff, opts = {}) {
    const def = instanceById(instId);
    if (!def) return false;
    const g = this.game;
    if (this.run) this.leave(true);
    if (g.char.level < def.levelMin) { g.ui.toast(`Нужен уровень ${def.levelMin}`, '#e88'); return false; }
    if (diff === 'heroic' && !g.instCfg.bots && def.size > 1 && !opts.withPlayers) { /* ok */ }
    const mult = diff === 'mythic' ? 2.6 : diff === 'heroic' ? 1.7 : 1.0;
    this.run = {
      def, diff, mult, wave: 0, total: def.waves,
      mobsLeft: def.mobs.reduce((a, m) => a + m[1], 0),
      endsAt: g.time + def.timerMin * 60,
      lockId: 'L' + Math.floor(Math.random() * 9000 + 1000),
      party: [g.char.name],
      serverRunId: null,
    };
    // серверный замок (если есть соединение)
    if (g.net && g.net.mode === 'live') g.net.sendInstCreate(instId, diff, this.run.party);
    // соло-боты: добираем отряд NPC-напарниками
    if (def.size > 1 && g.instCfg.bots && !opts.withPlayers) this.spawnBots(def.botCount || (def.size > 5 ? 3 : 2));
    this.buildScene();
    this.startWave(0);
    g.ui.toast(`Вход в инстанс: «${def.name}» (${DIFFICULTY[diff].name})`, DIFFICULTY[diff].color);
    g.ui.addChat(`Инстанс открыт. Lock ID: ${this.run.lockId}. Волн: ${def.waves}, таймер: ${def.timerMin} мин.`, '#c07ff0');
    g.ui.renderInstanceHud();
    return true;
  }

  spawnBots(n) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      const role = BOT_ROLES[i % BOT_ROLES.length];
      const parts = buildHumanoid({ hairColor: 0x2b2b33, clothColor: role.color, armorTint: role.color });
      const root = parts.root;
      root.position.set(g.char.pos.x + 2 + i * 1.5, 0, g.char.pos.z + 2);
      const label = makeLabel(`${role.name}: ${BOT_NAMES[(i + g.char.name.length) % BOT_NAMES.length]}`, null, '#8fd18f');
      label.position.y = 2.4; root.add(label);
      g.scene.add(root);
      this.bots.push({ parts, anim: new AnimController(parts), role, hp: 100 * role.hpMul, maxHp: 100 * role.hpMul, label, dead: false });
      this.run.party.push(BOT_NAMES[(i + g.char.name.length) % BOT_NAMES.length]);
    }
  }

  buildScene() {
    const g = this.game;
    this.sceneGroup = new THREE.Group();
    // арена: круг из светящихся пилонов вокруг текущей позиции игрока
    const cx = g.char.pos.x, cz = g.char.pos.z;
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x241a33, emissive: 0x3a2a55, roughness: 0.8 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7, 0.9), ringMat);
      pillar.position.set(cx + Math.cos(a) * 26, heightAt(cx + Math.cos(a) * 26, cz + Math.sin(a) * 26, g.seed) + 3.5, cz + Math.sin(a) * 26);
      this.sceneGroup.add(pillar);
      const light = new THREE.PointLight(0x8a4fd0, 0.5, 14);
      light.position.set(pillar.position.x, pillar.position.y + 4, pillar.position.z);
      this.sceneGroup.add(light);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(26, 48), new THREE.MeshStandardMaterial({ color: 0x1a1426, transparent: true, opacity: 0.55 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, heightAt(cx, cz, g.seed) + 0.03, cz);
    this.sceneGroup.add(floor);
    g.scene.add(this.sceneGroup);
  }

  startWave(no) {
    const g = this.game, def = this.run.def;
    this.run.wave = no;
    const isBossWave = no === def.waves - 1;
    const spawns = isBossWave ? [[def.boss, 1]] : def.mobs.map(([m, c]) => [m, Math.max(1, Math.round(c / def.waves))]);
    this.groupMobs = [];
    const cx = g.char.pos.x, cz = g.char.pos.z;
    for (const [typeId, count] of spawns) {
      for (let i = 0; i < Math.max(1, count); i++) {
        const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 12;
        const m = g.spawnMob(typeId, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
        // скелинг под инстанс: уровень и статы по полосе зоны + множитель сложности
        const lvl = Math.min(95, Math.round((this.run.diff === 'mythic' ? def.levelMax + 3 : def.levelMax) * 0.9));
        const scale = Math.max(1, lvl / Math.max(1, m.def.level));
        m.maxHp = Math.round(m.def.hp * scale * this.run.mult * (isBossWave ? 2.2 : 1));
        m.hp = m.maxHp;
        m.level = lvl;
        m.inst = this.run.lockId;
        m.isBoss = isBossWave || m.isBoss;
        m.respawnDelay = 1e9;                    // в инстансе мобы не респавнятся
        m.dmgMul = this.run.mult;
        this.groupMobs.push(m);
      }
    }
    g.ui.addChat(isBossWave ? `Волна ${no + 1}/${def.waves}: БОСС — ${MOBS[def.boss].name}!` : `Волна ${no + 1}/${def.waves}: зачищай арену.`, isBossWave ? '#ffb64a' : '#c07ff0');
    g.ui.renderInstanceHud();
  }

  onMobKilled(m) {
    if (!this.run || m.inst !== this.run.lockId) return;
    this.run.mobsLeft = Math.max(0, this.run.mobsLeft - 1);
    if (this.game.net && this.game.net.mode === 'live') this.game.net.sendInstKill(this.run.serverRunId, m.isBoss);
    const aliveInWave = this.groupMobs.some(x => x.uid === m.uid ? false : !x.dead);
    if (!aliveInWave) {
      if (this.run.wave + 1 >= this.run.total) this.finish(true);
      else { this.run.mobsLeft = 0; this.startWave(this.run.wave + 1); }
    }
    this.game.ui.renderInstanceHud();
  }

  tick(dt) {
    if (!this.run) return;
    const g = this.game;
    // ИИ ботов: держатся рядом, бьют ближайшего живого моба инстанса
    for (const b of this.bots) {
      if (b.dead) continue;
      let best = null, bd = 1e9;
      for (const m of this.groupMobs) if (!m.dead) { const d = b.parts.root.position.distanceTo(m.pos); if (d < bd) { bd = d; best = m; } }
      if (best) {
        const dir = new THREE.Vector3().subVectors(best.pos, b.parts.root.position); dir.y = 0;
        const dist = dir.length();
        if (dist > 2.2) { dir.normalize(); b.parts.root.position.addScaledVector(dir, Math.min(dist - 2, 4 * dt)); b.anim.play('run', g.time); }
        else b.anim.play('idle', g.time);
        b.parts.root.position.y = heightAt(b.parts.root.position.x, b.parts.root.position.z, g.seed);
        b.atk = (b.atk || 0) - dt;
        if (dist <= 3 && b.atk <= 0) { b.atk = 1.6; g.damageMob(best, Math.round(8 + g.char.level * 1.4 * b.role.dmgMul), false); }
      } else {
        const dir = new THREE.Vector3().subVectors(g.char.pos, b.parts.root.position); dir.y = 0;
        if (dir.length() > 3.5) { dir.normalize(); b.parts.root.position.addScaledVector(dir, 4 * dt); }
        b.parts.root.position.y = heightAt(b.parts.root.position.x, b.parts.root.position.z, g.seed);
        b.anim.play('idle', g.time);
      }
      b.parts.root.lookAt(b.parts.root.position.x + 0.001, b.parts.root.position.y, b.parts.root.position.z - 1);
    }
    // таймер забега
    if (g.time > this.run.endsAt) this.finish(false);
  }

  finish(success) {
    const g = this.game, run = this.run;
    if (!run) return;
    if (success) {
      const rw = run.def.rewards;
      const xp = Math.round(rw.xp * run.mult), gold = Math.round(rw.gold * run.mult);
      g.char.gold += gold;
      gainXp(g.char, xp, g);
      const got = [];
      for (const iid of rw.loot) if (ITEMS[iid] && Math.random() < 0.6 * run.mult) { addItem(g.char, iid, 1); got.push(ITEMS[iid]); }
      if (got.length) g.ui.lootPopup(got);
      g.fx.burst(g.char.pos, 0xffd24a, 40, 6, 0.7, 1.4);
      g.ui.toast(`Инстанс пройден: «${run.def.name}» +${xp} опыта, +${gold} зол.`, '#ffd24a');
      g.onQuestEvent('instance', { inst: run.def.id });
    } else {
      g.ui.toast(`Время в «${run.def.name}» истекло — забег провален.`, '#e88');
    }
    if (g.net && g.net.mode === 'live') g.net.sendInstLeave(run.serverRunId);
    this.leave(false);
  }

  leave(silent) {
    const g = this.game;
    for (const m of this.groupMobs) g.removeMob(m);
    this.groupMobs = [];
    for (const b of this.bots) g.scene.remove(b.parts.root);
    this.bots = [];
    if (this.sceneGroup) { g.scene.remove(this.sceneGroup); this.sceneGroup = null; }
    this.run = null;
    if (!silent) g.ui.renderInstanceHud();
  }
}
