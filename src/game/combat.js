// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — боевая система: урон, эффекты,
//  снаряды, частицы, всплывающие числа, AOE-зоны.
// ============================================================

import * as THREE from '../../vendor/three.module.js';
import { radialSprite } from './world.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class CombatFX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.projectiles = [];   // { mesh, vel, target, onHit, life }
    this.zones = [];         // { mesh, radius, dps, ttl, tickAcc, filter }
    this.particles = [];     // { sprite, vel, life, maxLife, gravity }
    this.floaters = [];      // { sprite, vy, life }
    this.shake = 0;
  }

  // --- Всплывающее число ------------------------------------------------------
  floatText(pos, text, colorCss = '#ffffff', big = false) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 48;
    const g = c.getContext('2d');
    g.font = `bold ${big ? 34 : 26}px Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 5;
    g.strokeText(text, 64, 24, 124);
    g.fillStyle = colorCss; g.fillText(text, 64, 24, 124);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    spr.scale.set(big ? 1.8 : 1.3, big ? 0.68 : 0.5, 1);
    spr.position.copy(pos); spr.position.y += 1.4;
    spr.renderOrder = 20;
    this.scene.add(spr);
    this.floaters.push({ sprite: spr, vy: 1.6, life: 1.1 });
  }

  // --- Частицы ----------------------------------------------------------------
  burst(pos, colorHex, count = 12, speed = 4, size = 0.35, life = 0.7) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialSprite('#ffffff', '#' + colorHex.toString(16).padStart(6, '0')),
        color: colorHex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.position.copy(pos); s.position.y += rand(0.4, 1.4);
      const sc = rand(size * 0.5, size);
      s.scale.set(sc, sc, 1);
      this.scene.add(s);
      const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize();
      this.particles.push({ sprite: s, vel: dir.multiplyScalar(rand(speed * 0.4, speed)), life: rand(life * 0.6, life), maxLife: life, gravity: 6 });
    }
  }

  // --- Снаряд ------------------------------------------------------------------
  launchProjectile(fromPos, targetEntity, opts = {}) {
    const color = opts.color || 0xb060ff;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ffffff', '#' + color.toString(16).padStart(6, '0')),
      color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    spr.scale.set(opts.size || 0.5, opts.size || 0.5, 1);
    spr.position.copy(fromPos); spr.position.y += 1.2;
    this.scene.add(spr);
    this.projectiles.push({
      mesh: spr, target: targetEntity, speed: opts.speed || 26,
      damage: opts.damage || 0, crit: !!opts.crit, effect: opts.effect || null,
      attacker: opts.attacker || null, onHit: opts.onHit || null, life: 3, trail: opts.trail || null,
    });
  }

  // --- Зона (ночной жар и т.п.) -------------------------------------------------
  addZone(pos, radius, colorHex, opts = {}) {
    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos); m.position.y += 0.06;
    this.scene.add(m);
    // столб пламени
    const pillar = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ffd27a', '#' + colorHex.toString(16).padStart(6, '0')),
      transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pillar.scale.set(radius * 1.6, radius * 2.2, 1);
    pillar.position.copy(pos); pillar.position.y += radius * 0.8;
    this.scene.add(pillar);
    this.zones.push({ mesh: m, pillar, radius, dps: opts.dps || 0, ttl: opts.ttl || 5, tickAcc: 0, owner: opts.owner || null });
  }

  shakeScreen(amount) { this.shake = Math.max(this.shake, amount); }

  update(dt, game) {
    // Снаряды
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const tgt = p.target && !p.target.dead ? p.target.pos : p.lastPos;
      if (!tgt || p.life <= 0) {
        this._killProjectile(p, false);
        this.projectiles.splice(i, 1); continue;
      }
      p.lastPos = tgt.clone ? tgt.clone() : new THREE.Vector3(tgt.x, tgt.y || 1, tgt.z);
      const to = new THREE.Vector3(p.lastPos.x, (p.lastPos.y || 0) + 1.1, p.lastPos.z).sub(p.mesh.position);
      const d = to.length();
      const step = p.speed * dt;
      if (d <= step + 0.4) {
        this._killProjectile(p, true);
        this.projectiles.splice(i, 1);
      } else {
        p.mesh.position.add(to.normalize().multiplyScalar(step));
      }
    }
    // Зоны
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.ttl -= dt; z.tickAcc += dt;
      const pulse = 0.28 + Math.sin(performance.now() * 0.006) * 0.1;
      z.mesh.material.opacity = pulse;
      z.pillar.material.opacity = pulse * 0.9;
      if (z.tickAcc >= 0.5) {
        z.tickAcc = 0;
        if (z.dps > 0 && game) {
          for (const m of game.mobs) {
            if (m.dead) continue;
            if (Math.hypot(m.pos.x - z.mesh.position.x, m.pos.z - z.mesh.position.z) <= z.radius) {
              game.damageMob(m, z.dps * 0.5, { source: 'zone', silentCrit: true });
            }
          }
        }
      }
      if (z.ttl <= 0) {
        this.scene.remove(z.mesh); this.scene.remove(z.pillar);
        z.mesh.geometry.dispose(); z.mesh.material.dispose();
        this.zones.splice(i, 1);
      }
    }
    // Частицы
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.sprite); this.particles.splice(i, 1); continue; }
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.material.opacity = Math.max(0, p.life / p.maxLife);
    }
    // Числа
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.sprite); f.sprite.material.map.dispose(); f.sprite.material.dispose();
        this.floaters.splice(i, 1); continue;
      }
      f.sprite.position.y += f.vy * dt;
      f.vy *= 0.94;
      f.sprite.material.opacity = Math.min(1, f.life * 2);
    }
    // Тряска камеры
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 8);
  }

  _killProjectile(p, hit) {
    this.scene.remove(p.mesh);
    p.mesh.material.map.dispose(); p.mesh.material.dispose();
    if (hit) {
      this.burst(p.mesh.position, 0xb060ff, 8, 3, 0.25, 0.4);
      if (p.onHit) p.onHit(p.target, p.damage, p.crit, p.effect);
    }
  }
}

// Расчёт урона игроком по цели-мобу
export function rollPlayerDamage(stats, mult = 1, critBonus = 0) {
  const base = stats.dmgBase * mult;
  const critChance = stats.crit + critBonus;
  const isCrit = Math.random() * 100 < critChance;
  let dmg = base * rand(0.85, 1.15);
  if (isCrit) dmg *= 1.8;
  return { dmg: Math.max(1, Math.round(dmg)), crit: isCrit };
}

// Урон моба по игроку с учётом защиты/блока
export function rollMobDamage(mob, playerStats) {
  let dmg = rand(mob.def.dmg[0], mob.def.dmg[1]) * (0.85 + mob.level * 0.05);
  // снижение за Защита
  const reduce = playerStats.ward * 0.6;
  dmg = Math.max(1, dmg - reduce);
  // блок
  const blockChance = Math.min(40, playerStats.block + (playerStats.passives.blockBonus || 0));
  const blocked = Math.random() * 100 < blockChance;
  if (blocked) dmg *= 0.3;
  // щит (Бастион)
  let shielded = false;
  if (playerStats.shieldRatio > 0) { dmg *= (1 - playerStats.shieldRatio); shielded = true; }
  return { dmg: Math.max(1, Math.round(dmg)), blocked, shielded };
}
