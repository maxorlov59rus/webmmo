// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — процедурные 3D-модели персонажей,
//  мобов и NPC. Никаких внешних ассетов: всё из примитивов.
// ============================================================

import * as THREE from '../../vendor/three.module.js';
import { radialSprite } from './world.js';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });

// --- Боевой антропоморфный скелет для всех «гуманоидов» ----------------------
// parts: { root, hips, torso, head, armL, armR, legL, legR, weapon, cloak? }
export function buildHumanoid(opts) {
  const {
    skin = 0xc9a27a, cloth = 0x33415c, accent = 0x8a6d3b, metal = 0x9aa0a8,
    weaponType = 'sword', cloak = false, scale = 1,
  } = opts;

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.0 * scale; root.add(hips);

  const torso = new THREE.Group(); hips.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), M(cloth));
  chest.position.y = 0.46; torso.add(chest);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.4), M(accent));
  belt.position.y = 0.08; torso.add(belt);
  // наплечники
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), M(metal, { metalness: 0.5, roughness: 0.5 }));
    sh.position.set(s * 0.4, 0.78, 0); torso.add(sh);
  }

  const head = new THREE.Group(); head.position.y = 1.02; torso.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.32), M(skin));
  skull.position.y = 0.18; head.add(skull);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(metal, { metalness: 0.5, roughness: 0.5 }));
  helm.position.y = 0.3; head.add(helm);
  // глаза-точки (ночью видно)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    eye.position.set(s * 0.08, 0.2, 0.17); head.add(eye);
  }

  // Руки: pivot на плече
  function arm(side) {
    const g = new THREE.Group(); g.position.set(side * 0.42, 0.72, 0); torso.add(g);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), M(cloth));
    upper.position.y = -0.26; g.add(upper);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), M(skin));
    hand.position.y = -0.56; g.add(hand);
    return g;
  }
  const armL = arm(-1), armR = arm(1);

  function leg(side) {
    const g = new THREE.Group(); g.position.set(side * 0.18, 0, 0); hips.add(g);
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), M(cloth === 0x33415c ? 0x2b3548 : cloth));
    th.position.y = -0.3; g.add(th);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.3), M(accent));
    boot.position.set(0, -0.62, 0.04); g.add(boot);
    return g;
  }
  const legL = leg(-1), legR = leg(1);

  // Оружие в правой руке
  const weapon = new THREE.Group(); weapon.position.y = -0.6; armR.add(weapon);
  if (weaponType === 'sword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.02), M(metal, { metalness: 0.8, roughness: 0.3 }));
    blade.position.y = 0.6; weapon.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), M(accent));
    weapon.add(guard);
  } else if (weaponType === 'staff') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), M(0x5a4630));
    shaft.position.y = 0.4; weapon.add(shaft);
    const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#d8b6ff', '#7a3fd0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    orb.position.y = 1.25; orb.scale.set(0.5, 0.5, 1); weapon.add(orb);
    weapon.userData.orb = orb;
  } else if (weaponType === 'spear') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6), M(0x5a4630));
    shaft.position.y = 0.6; weapon.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), M(metal, { metalness: 0.7 }));
    tip.position.y = 1.8; weapon.add(tip);
  } else if (weaponType === 'axe') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 6), M(0x4a3a28));
    shaft.position.y = 0.35; weapon.add(shaft);
    const headA = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.1), M(metal, { metalness: 0.7, roughness: 0.4 }));
    headA.position.set(0.22, 0.9, 0); weapon.add(headA);
  }

  let cloakMesh = null;
  if (cloak) {
    cloakMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), M(accent, { side: THREE.DoubleSide }));
    cloakMesh.position.set(0, 0.35, -0.24); cloakMesh.rotation.x = 0.12;
    torso.add(cloakMesh);
  }

  root.scale.setScalar(scale);
  return { root, hips, torso, head, armL, armR, legL, legR, weapon, cloakMesh };
}

// Простой покадровый цикл анимации: idle / walk / attack / cast / hit / die
export class AnimController {
  constructor(parts) {
    this.p = parts;
    this.state = 'idle';
    this.t = 0;
    this.attackT = 0;   // прогресс атаки 0..1
    this.dead = false;
    this.deathT = 0;
  }
  setState(s) { if (s !== 'attack' && s !== 'hit') this.state = s; }
  triggerAttack(dur = 0.5) { this.state = 'attack'; this.attackT = 0; this.attackDur = dur; }
  triggerHit() { this.hitT = 0.18; }
  kill() { this.dead = true; this.deathT = 0; }

  update(dt) {
    const p = this.p;
    if (this.dead) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.8);
      p.root.rotation.x = -k * Math.PI / 2 * 0.9;
      p.root.position.y = -k * 0.4;
      return;
    }
    this.t += dt;
    const time = this.t;

    // сброс базовых поз
    p.armL.rotation.set(0, 0, 0.08);
    p.armR.rotation.set(0, 0, -0.08);
    p.legL.rotation.x = 0; p.legR.rotation.x = 0;
    p.torso.rotation.x = 0; p.head.rotation.x = 0;
    p.hips.position.y = 1.0;

    if (this.hitT > 0) { this.hitT -= dt; p.torso.rotation.x = 0.3; }

    switch (this.state) {
      case 'idle': {
        const b = Math.sin(time * 2.2) * 0.03;
        p.hips.position.y += b;
        p.torso.rotation.y = Math.sin(time * 0.7) * 0.06;
        p.armL.rotation.z = 0.08 + b * 0.5; p.armR.rotation.z = -0.08 - b * 0.5;
        break;
      }
      case 'walk': {
        const w = time * 9;
        p.legL.rotation.x = Math.sin(w) * 0.7;
        p.legR.rotation.x = -Math.sin(w) * 0.7;
        p.armL.rotation.x = -Math.sin(w) * 0.5;
        p.armR.rotation.x = Math.sin(w) * 0.5;
        p.hips.position.y += Math.abs(Math.sin(w)) * 0.06;
        break;
      }
      case 'attack': {
        this.attackT += dt / (this.attackDur || 0.5);
        const k = Math.min(1, this.attackT);
        // замах -> удар
        const swing = k < 0.4 ? -(k / 0.4) * 1.9 : -1.9 + ((k - 0.4) / 0.6) * 3.1;
        p.armR.rotation.x = swing;
        p.torso.rotation.y = (k < 0.4 ? -0.4 : 0.5) * Math.sin(k * Math.PI);
        if (k >= 1) this.state = 'idle';
        break;
      }
      case 'cast': {
        p.armR.rotation.x = -1.6;
        p.armL.rotation.x = -1.2;
        p.torso.rotation.x = -0.1;
        break;
      }
      default: break;
    }
  }
}

// --- Мобы ---------------------------------------------------------------------
export function buildMobMesh(shape, colorHex) {
  const c = colorHex;
  if (shape === 'wolf') {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.5), M(0x2a2f3a));
    body.position.y = 0.75; grp.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.6), M(0x333a47));
    head.position.set(0, 1.0, 0.95); grp.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.3), M(0x22262e));
    snout.position.set(0, 0.92, 1.3); grp.add(snout);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), M(0x22262e));
      ear.position.set(s * 0.15, 1.28, 0.85); grp.add(ear);
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#ffdd88', '#ff8833'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      eye.position.set(s * 0.12, 1.02, 1.22); eye.scale.set(0.14, 0.14, 1); grp.add(eye);
    }
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), M(0x22262e));
      leg.position.set(sx * 0.25, 0.3, sz * 0.55); grp.add(leg); legs.push(leg);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.7), M(0x2a2f3a));
    tail.position.set(0, 0.85, -0.95); grp.add(tail);
    grp.userData = { legs, tail, head };
    return grp;
  }
  if (shape === 'skeleton') {
    const h = buildHumanoid({ skin: 0xd8d2c4, cloth: 0x5a5648, accent: 0x8a7a50, metal: 0xb0aca0, weaponType: 'sword', scale: 0.95 });
    h.torso.children[0].material = M(0xcfc8b8); // рёбра светлее
    return h;
  }
  if (shape === 'shade') {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.9, 8), M(0x141024, { transparent: true, opacity: 0.75, emissive: 0x2a1a4a }));
    core.position.y = 1.1; grp.add(core);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.6), M(0x0d0a18));
    hood.position.y = 1.85; grp.add(hood);
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#b060ff', '#5a20a0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      e.position.set(s * 0.13, 1.8, 0.32); e.scale.set(0.18, 0.18, 1); grp.add(e); eyes.push(e);
    }
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#6a3fa0', '#2a1050'), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.position.y = 1.2; aura.scale.set(2.6, 2.6, 1); grp.add(aura);
    grp.userData = { eyes, aura, isShade: true };
    return grp;
  }
  if (shape === 'overseer') {
    const h = buildHumanoid({ skin: 0x3a2f4a, cloth: 0x1a1426, accent: 0x6a2fa0, metal: 0x8a4fd0, weaponType: 'axe', cloak: true, scale: 1.7 });
    // рога
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), M(0x2a2030));
      horn.position.set(s * 0.28, 2.15, 0); horn.rotation.z = s * -0.5; h.head.add(horn);
    }
    const glow = new THREE.PointLight(0x8a4fd0, 1.6, 10, 2); glow.position.y = 2; h.root.add(glow);
    return h;
  }
  // запасной вариант — гуманоид
  return buildHumanoid({});
}

// --- Игрок / другие игроки ----------------------------------------------------
export function buildPlayerMesh(cls, colorHex) {
  const base = new THREE.Color(colorHex);
  const cloth = base.getHex();
  const wt = cls === 'mage' ? 'staff' : cls === 'scout' ? 'spear' : 'sword';
  const parts = buildHumanoid({
    skin: 0xd8b48c, cloth, accent: 0x2a2a34, metal: 0xaab4c4,
    weaponType: wt, cloak: cls !== 'mage', scale: 1,
  });
  // подсветка класса
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24),
    new THREE.MeshBasicMaterial({ color: cloth, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  parts.root.add(ring);
  parts.selectRing = ring;
  return parts;
}

// --- NPC ----------------------------------------------------------------------
export function buildNpcMesh(npc) {
  const col = new THREE.Color(npc.color).getHex();
  let parts;
  if (npc.id === 'dormir') {
    parts = buildHumanoid({ skin: 0xc98d5a, cloth: 0x4a2f1c, accent: 0x8a5a2a, metal: 0x9aa0a8, weaponType: 'none', scale: 1.05 });
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), M(0x5a4630));
    hammer.position.y = -0.3; parts.armR.add(hammer);
    const hhead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), M(0x777d84, { metalness: 0.6 }));
    hhead.position.y = -0.85; parts.armR.add(hhead);
  } else if (npc.id === 'ilva') {
    parts = buildHumanoid({ skin: 0xd8b48c, cloth: 0x4a3a6a, accent: 0x6a4fa0, metal: 0x8a6fd0, weaponType: 'staff' });
    parts.cloakMesh = null;
  } else {
    parts = buildHumanoid({ skin: 0xc9a27a, cloth: col, accent: 0x6fa8d0, metal: 0x9aa8b8, weaponType: 'spear' });
  }
  return parts;
}

// Надпись имени/HP над головой — спрайт из canvas
export function makeLabel(text, sub, colorCss) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 72);
  g.font = 'bold 24px Georgia, serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(28, 2, 200, 30);
  g.fillStyle = colorCss || '#e8e2d0';
  g.fillText(text, 128, 24, 240);
  if (sub) {
    g.font = '16px Georgia, serif';
    g.fillStyle = '#b8c4d8';
    g.fillText(sub, 128, 52, 240);
  }
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.scale.set(2.6, 0.73, 1);
  spr.renderOrder = 10;
  return spr;
}

export function updateLabelTexture(sprite, text, hpRatio, colorCss) {
  const tex = sprite.material.map;
  const c = tex.image, g = c.getContext('2d');
  g.clearRect(0, 0, 256, 72);
  g.font = 'bold 24px Georgia, serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(28, 2, 200, 30);
  g.fillStyle = colorCss || '#e8e2d0';
  g.fillText(text, 128, 24, 240);
  if (hpRatio != null) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(48, 40, 160, 10);
    g.fillStyle = hpRatio > 0.5 ? '#5ad05a' : hpRatio > 0.25 ? '#e8c040' : '#e05050';
    g.fillRect(48, 40, 160 * Math.max(0, hpRatio), 10);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.strokeRect(48, 40, 160, 10);
  }
  tex.needsUpdate = true;
}
