// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — процедурная генерация мира (3D)
//  Терреин по шуму, палисад заставы, кузница, кострища, курганы,
//  деревья, камни, факелы, звёздное небо и туман.
// ============================================================

import * as THREE from '../../vendor/three.module.js';
import { LOCATIONS } from '../data/consts.js';
import { buildMobMesh } from './models.js';

// --- Детерминированный шум ---------------------------------------------------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = ix * 374761393 + iz * 668265263 + seed * 144665;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function fbm(x, z, seed, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * valueNoise(x * f, z * f, seed + i * 97); amp *= 0.5; f *= 2; }
  return v;
}

// Высота в точке — используется и для коллизий персонажа
export function heightAt(x, z, seed) {
  const base = fbm(x * 0.035, z * 0.035, seed, 4) * 6.5;
  const detail = fbm(x * 0.12, z * 0.12, seed + 13, 2) * 0.9;
  // Чаша вокруг центра заставы — площадка
  const r = Math.hypot(x, z);
  const flatten = THREE.MathUtils.smoothstep(r, 6, 22);
  return (base + detail) * flatten + (1 - flatten) * 0.15;
}

// --- Текстура земли (ночная, тёмно-зелёная с морозными прожилками) ----------
function makeGroundTexture(seed) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.fillStyle = '#16241a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 512, y = rnd() * 512, s = rnd() * 2.2 + 0.4;
    const shade = rnd();
    if (shade < 0.6) g.fillStyle = `rgba(${20 + shade * 30},${40 + shade * 40},${26 + shade * 24},0.5)`;
    else if (shade < 0.85) g.fillStyle = 'rgba(40,34,24,0.5)';   // грязь
    else g.fillStyle = 'rgba(90,100,110,0.35)';                  // иней
    g.fillRect(x, y, s, s);
  }
  // тропы к постройкам
  g.strokeStyle = 'rgba(52,44,32,0.5)'; g.lineWidth = 14; g.lineCap = 'round';
  g.beginPath(); g.moveTo(256, 256); g.lineTo(360, 180); g.stroke();
  g.beginPath(); g.moveTo(256, 256); g.lineTo(150, 320); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

// --- Звёздное небо + луна -----------------------------------------------------
function makeSkybox(scene) {
  const geo = new THREE.SphereGeometry(420, 24, 16);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#05070f'); grad.addColorStop(0.55, '#0a1024'); grad.addColorStop(1, '#141c30');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
  const rnd = mulberry32(777);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 1024, y = rnd() * 420, r = rnd() * 1.4 + 0.2;
    g.globalAlpha = 0.3 + rnd() * 0.7;
    g.fillStyle = rnd() > 0.9 ? '#cfe0ff' : '#ffffff';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // Млечный Путь
  for (let i = 0; i < 2200; i++) {
    const t = rnd(); const x = t * 1024; const y = 120 + Math.sin(t * 6) * 60 + (rnd() - 0.5) * 90;
    g.fillStyle = `rgba(200,215,255,${rnd() * 0.25})`;
    g.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  scene.add(sky);

  // Луна со свечением
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialSprite('#e8eeff', '#aab8dd'), color: 0xffffff, transparent: true, opacity: 0.95,
  }));
  moon.position.set(-140, 120, -260); moon.scale.set(60, 60, 1);
  scene.add(moon);
  return sky;
}

export function radialSprite(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, inner); grd.addColorStop(0.4, outer || inner); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// --- Деревья / камни ----------------------------------------------------------
function makeTree(x, z, seed, rnd) {
  const grp = new THREE.Group();
  const h = 3.2 + rnd() * 2.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.28, h * 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 1 })
  );
  trunk.position.y = h * 0.25; grp.add(trunk);
  const layers = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < layers; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.5 - i * 0.35, 1.8, 7),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x14321f : 0x183a26, roughness: 1 })
    );
    cone.position.y = h * 0.45 + i * 1.0; grp.add(cone);
  }
  grp.position.set(x, heightAt(x, z, seed), z);
  grp.rotation.y = rnd() * 6.28;
  return grp;
}

function makeRock(x, z, seed, rnd) {
  const g = new THREE.DodecahedronGeometry(0.5 + rnd() * 0.9, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 1, flatShading: true }));
  m.position.set(x, heightAt(x, z, seed) + 0.2, z);
  m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  m.scale.set(1, 0.7 + rnd() * 0.5, 1);
  return m;
}

// --- Постройки ----------------------------------------------------------------
function woodMat() { return new THREE.MeshStandardMaterial({ color: 0x3d2c1c, roughness: 1 }); }
function stoneMat() { return new THREE.MeshStandardMaterial({ color: 0x494d52, roughness: 1, flatShading: true }); }

function makePalisade(scene, seed, radius) {
  const grp = new THREE.Group();
  const n = 56;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (a > 1.2 && a < 1.7) continue; // ворота на юго-востоке
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const h = 2.2 + (hash2(i, 3, seed) * 0.5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, h, 6), woodMat());
    post.position.set(x, heightAt(x, z, seed) + h / 2, z);
    post.rotation.y = a;
    grp.add(post);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 6), woodMat());
    tip.position.set(x, heightAt(x, z, seed) + h + 0.2, z);
    grp.add(tip);
  }
  scene.add(grp);
  return grp;
}

function makeForge(scene, x, z, seed) {
  const grp = new THREE.Group();
  const y = heightAt(x, z, seed);
  // корпус
  const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), woodMat());
  body.position.set(0, 1.3, 0); grp.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 }));
  roof.position.set(0, 3.3, 0); roof.rotation.y = Math.PI / 4; grp.add(roof);
  // труба
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 6), stoneMat());
  chim.position.set(1.2, 4.2, -0.6); grp.add(chim);
  // горн с углями
  const forge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), stoneMat());
  forge.position.set(-2.6, 0.35, 0.4); grp.add(forge);
  const coals = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8),
    new THREE.MeshBasicMaterial({ map: radialSprite('#ffb060', '#ff5520'), transparent: true, color: 0xff7733 }));
  coals.rotation.x = -Math.PI / 2; coals.position.set(-2.6, 0.71, 0.4); grp.add(coals);
  const fireLight = new THREE.PointLight(0xff7733, 2.4, 12, 2);
  fireLight.position.set(-2.6, 1.2, 0.4); grp.add(fireLight);
  // наковальня
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.7, roughness: 0.4 }));
  anvil.position.set(-3.6, 0.55, 1.2); grp.add(anvil);
  grp.position.set(x, y, z);
  scene.add(grp);
  return { group: grp, light: fireLight, coals };
}

function makeBonfire(scene, x, z, seed) {
  const grp = new THREE.Group();
  const y = heightAt(x, z, seed);
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 5), woodMat());
    log.rotation.z = Math.PI / 2.4; log.rotation.y = (i / 5) * Math.PI * 2;
    log.position.y = 0.25; grp.add(log);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialSprite('#ffd27a', '#ff6a2a'), transparent: true, color: 0xffaa55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  flame.scale.set(1.6, 2.2, 1); flame.position.y = 1.1; grp.add(flame);
  const light = new THREE.PointLight(0xff8844, 2.2, 14, 2);
  light.position.y = 1.4; grp.add(light);
  grp.position.set(x, y, z);
  scene.add(grp);
  return { group: grp, flame, light, base: 2.2 };
}

function makeKurgan(scene, x, z, seed, rnd) {
  const grp = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x26301f, roughness: 1, flatShading: true }));
  mound.scale.y = 0.5; grp.add(mound);
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1 + rnd(), 0.25), stoneMat());
    const a = rnd() * 6.28; st.position.set(Math.cos(a) * 2.2, 0.6, Math.sin(a) * 2.2);
    st.rotation.z = (rnd() - 0.5) * 0.4; grp.add(st);
  }
  grp.position.set(x, heightAt(x, z, seed), z);
  scene.add(grp);
  return grp;
}

function makeBannerPole(scene, x, z, seed, color) {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 5), woodMat());
  pole.position.y = 2.5; grp.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.8),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }));
  cloth.position.set(0.72, 3.6, 0); cloth.name = 'cloth'; grp.add(cloth);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: 0xe8eeff }));
  moon.position.set(0.72, 3.8, 0.02); grp.add(moon);
  grp.position.set(x, heightAt(x, z, seed), z);
  scene.add(grp);
  return grp;
}

// --- Сборка мира --------------------------------------------------------------
export function buildWorld(scene, seed) {
  const rnd = mulberry32(seed);
  const world = { props: [], torches: [], bonfires: [], colliders: [], bannerCloths: [] };

  // Освещение ночи
  scene.fog = new THREE.FogExp2(0x0a1020, 0.016);
  scene.add(new THREE.HemisphereLight(0x2a3a5c, 0x0c1410, 0.55));
  const moonLight = new THREE.DirectionalLight(0x9fb4e8, 0.5);
  moonLight.position.set(-60, 80, -100);
  scene.add(moonLight);

  makeSkybox(scene);

  // Терреин
  const SIZE = 150, SEG = 130;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z, seed);
    pos.setY(i, h);
    // цвет по высоте/влажности
    const t = THREE.MathUtils.clamp((h + 1) / 7, 0, 1);
    col.setHSL(0.32 - t * 0.06, 0.35, 0.08 + t * 0.06);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: makeGroundTexture(seed), vertexColors: true, roughness: 1,
  }));
  scene.add(ground);
  world.ground = ground;

  // Палисад вокруг центра
  makePalisade(scene, seed, 16);
  //Colliders частокола (кольцевая проверка обрабатывается отдельно через радиус)
  world.palisadeRadius = 16;

  // Кузница Дормира
  const forge = makeForge(scene, 6, -4, seed);
  world.forge = forge;
  world.colliders.push({ type: 'box', x: 6, z: -4, hx: 2.4, hz: 1.9 });

  // Шатёр Илвы
  const tent = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3a6a, roughness: 1 }));
  canopy.position.y = 1.3; tent.add(canopy);
  tent.position.set(-8, heightAt(-8, 5, seed), 5);
  scene.add(tent);
  world.colliders.push({ type: 'box', x: -8, z: 5, hx: 2.0, hz: 2.0 });

  // Кострища у курганов (спавн скелетов)
  const bonfireSpots = [[-28, 18], [24, 26], [30, -22]];
  for (const [bx, bz] of bonfireSpots) {
    world.bonfires.push(makeBonfire(scene, bx, bz, seed));
    world.colliders.push({ type: 'box', x: bx, z: bz, hx: 0.8, hz: 0.8 });
  }

  // Факелы вдоль троп к воротам
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 12.5, z = Math.sin(a) * 12.5;
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 5), woodMat());
    pole.position.y = 1.1; grp.add(pole);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ffe0a0', '#ff7a30'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    fl.scale.set(0.7, 1.0, 1); fl.position.y = 2.35; grp.add(fl);
    const lt = new THREE.PointLight(0xff8840, 1.4, 9, 2); lt.position.y = 2.4; grp.add(lt);
    grp.position.set(x, heightAt(x, z, seed), z);
    scene.add(grp);
    world.torches.push({ flame: fl, light: lt, base: 1.4, phase: rnd() * 6 });
  }

  // Курганы
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2, r = 26 + rnd() * 30;
    makeKurgan(scene, Math.cos(a) * r, Math.sin(a) * r, seed, rnd);
  }

  // === Визуальные якоря локаций (LOCATIONS в src/data/consts.js) ===
  // Каждая локация = группа декораций вокруг anchor*10: трава, камни, постройки.

  // Ночная Застава (outpost): дозорная вышка + костёр часовой у ворот
  {
    const [ax, az] = LOCATIONS.outpost.anchor.map(v => v * 10);
    const tower = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.6, 5), woodMat());
      leg.position.set((i % 2 ? 1 : -1) * 0.9, 2.3, (i < 2 ? 1 : -1) * 0.9);
      leg.rotation.z = (i % 2 ? -1 : 1) * 0.06; tower.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), woodMat());
    deck.position.y = 4.6; tower.add(deck);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 }));
    roof.position.y = 6.0; roof.rotation.y = Math.PI / 4; tower.add(roof);
    const brazier = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#ffe0a0', '#ff7a30'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    brazier.scale.set(1.1, 1.4, 1); brazier.position.y = 5.2; tower.add(brazier);
    const tl = new THREE.PointLight(0xff8840, 1.8, 16, 2); tl.position.y = 5.2; tower.add(tl);
    tower.position.set(ax - 11, heightAt(ax - 11, az - 11, seed), az - 11);
    scene.add(tower); world.colliders.push({ type: 'box', x: ax - 11, z: az - 11, hx: 1.2, hz: 1.2 });
    world.torches.push({ flame: brazier, light: tl, base: 1.8, phase: rnd() * 6 });
    const guardFire = makeBonfire(scene, ax + 3, az + 13, seed);
    world.bonfires.push(guardFire);
  }

  // Выгоршая Пустошь (hollow): стеклянные воронки от «луча» + спекшаяся земля
  {
    const [hx, hz] = LOCATIONS.hollow.anchor.map(v => v * 10);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, metalness: 0.4, roughness: 0.25, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 7; i++) {
      const a = rnd() * 6.28, r = rnd() * 20;
      const x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
      const crater = new THREE.Mesh(new THREE.CylinderGeometry(2.2 + rnd() * 1.6, 1.2, 0.5, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.6, side: THREE.DoubleSide }));
      crater.position.set(x, heightAt(x, z, seed) + 0.1, z); scene.add(crater);
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rnd() * 0.5, 1.6 + rnd() * 1.4, 6), glassMat);
      shard.position.set(x + rnd() - 0.5, heightAt(x, z, seed) + 0.7, z + rnd() - 0.5);
      shard.rotation.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5); scene.add(shard);
    }
    // тёплая люминитовая прожилка — светится из-под стекла
    const vein = new THREE.Mesh(new THREE.TorusGeometry(9, 0.18, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb060 }));
    vein.rotation.x = -Math.PI / 2; vein.position.set(hx, heightAt(hx, hz, seed) + 0.06, hz);
    scene.add(vein);
    const vl = new THREE.PointLight(0xff9a50, 1.2, 20, 2); vl.position.set(hx, 2, hz); scene.add(vl);
  }

  // Курганы Первых Дозоров (barrow): большой курган с кругом камней + знамёна Первого Дозора
  {
    const [bx, bz] = LOCATIONS.barrow.anchor.map(v => v * 10);
    const big = new THREE.Mesh(new THREE.SphereGeometry(5.2, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x26301f, roughness: 1, flatShading: true }));
    big.scale.y = 0.55; big.position.set(bx, heightAt(bx, bz, seed), bz); scene.add(big);
    world.colliders.push({ type: 'tree', x: bx, z: bz, r: 4.6 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6 + rnd() * 0.8, 0.4), stoneMat());
      const x = bx + Math.cos(a) * 7.4, z = bz + Math.sin(a) * 7.4;
      st.position.set(x, heightAt(x, z, seed) + 0.8, z); st.rotation.z = (rnd() - 0.5) * 0.3; scene.add(st);
    }
    makeBannerPole(scene, bx + 2.5, bz + 6, seed, 0x4a4a55);
    makeBonfire(scene, bx - 6, bz - 4, seed);
    makeBonfire(scene, bx + 7, bz - 2, seed);
  }

  // Сумеречный Бор (pinewood): тотемы Детей Сумерек + ручные химеры у тотема
  {
    const [px, pz] = LOCATIONS.pinewood.anchor.map(v => v * 10);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28 + 0.5;
      const x = px + Math.cos(a) * 8, z = pz + Math.sin(a) * 8;
      const tot = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 3.4, 7),
        new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 1 }));
      trunk.position.y = 1.7; tot.add(trunk);
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x6fcf97, emissive: 0x1a4a2a, roughness: 0.8 }));
      mask.position.y = 3.2; tot.add(mask);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#b8ffd0', '#2a6a4a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.6, 1.6, 1); glow.position.y = 3.2; tot.add(glow);
      tot.position.set(x, heightAt(x, z, seed), z); scene.add(tot);
      world.colliders.push({ type: 'tree', x, z, r: 0.6 });
    }
    // ручные химеры спят у центрального тотема (декорации, не агрят)
    for (let i = 0; i < 2; i++) {
      const tamed = buildMobMesh('chimera');
      const x = px + 2 + i * 2.2, z = pz - 1;
      tamed.position.set(x, heightAt(x, z, seed) + 0.1, z);
      tamed.rotation.y = rnd() * 6.28; tamed.scale.setScalar(0.8);
      scene.add(tamed);
    }
  }

  // Разрытая Шахта (minecamp): ствол шахты, паровой подъёмник, клеть, lum-жилы
  {
    const [mx, mz] = LOCATIONS.minecamp.anchor.map(v => v * 10);
    const shaft = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.22, 6, 4, Math.PI), woodMat());
    frame.rotation.x = Math.PI / 2; frame.position.y = 1.8; shaft.add(frame);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.6, 6), woodMat());
      post.position.set(s * 1.8, 1.8, 0); shaft.add(post);
    }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.14, 6, 16), new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.7, roughness: 0.4 }));
    wheel.position.set(0, 3.9, 0); wheel.name = 'wheel'; shaft.add(wheel);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x3d2c1c, wireframe: true }));
    cage.position.set(0, 1.2, 0); cage.name = 'cage'; shaft.add(cage);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), woodMat());
    rope.position.set(0, 2.6, 0); shaft.add(rope);
    shaft.position.set(mx, heightAt(mx, mz, seed), mz); scene.add(shaft);
    world.colliders.push({ type: 'box', x: mx, z: mz, hx: 2.2, hz: 1.2 });
    world.mineWheel = wheel; world.mineCage = cage;
    // steam — паровой выхлоп подъёмника
    const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#dfe8f0', '#5a6a7a'), transparent: true, opacity: 0.5, depthWrite: false }));
    steam.scale.set(1.4, 1.8, 1); steam.position.set(mx + 2.6, heightAt(mx + 2, mz, seed) + 2.6, mz);
    scene.add(steam); world.steam = steam;
    // люминитовые жилы в породе
    for (let i = 0; i < 6; i++) {
      const a = rnd() * 6.28, r = 4 + rnd() * 12;
      const x = mx + Math.cos(a) * r, z = mz + Math.sin(a) * r;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5 + rnd(), 1.4 + rnd()),
        new THREE.MeshStandardMaterial({ color: 0x3a2f22, emissive: 0xffb060, emissiveIntensity: 0.9, roughness: 0.6 }));
      seam.position.set(x, heightAt(x, z, seed) + 0.3, z); seam.rotation.y = rnd() * 3; scene.add(seam);
    }
    // факелы вдоль лавы
    for (let i = 0; i < 4; i++) {
      const x = mx - 4 + i * 2.6, z = mz + 3;
      const grp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 5), woodMat());
      pole.position.y = 0.9; grp.add(pole);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#ffe0a0', '#ff7a30'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.scale.set(0.6, 0.9, 1); fl.position.y = 1.9; grp.add(fl);
      const lt = new THREE.PointLight(0xff8840, 1.2, 8, 2); lt.position.y = 2; grp.add(lt);
      grp.position.set(x, heightAt(x, z, seed), z); scene.add(grp);
      world.torches.push({ flame: fl, light: lt, base: 1.2, phase: rnd() * 6 });
    }
  }

  // Причалы Аэрии (aeriadocks): кренящийся корпус галеры, мачты-краны, мостки, фонари
  {
    const [dx, dz] = LOCATIONS.aeriadocks.anchor.map(v => v * 10);
    const hull = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 12, 8, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 1, side: THREE.DoubleSide }));
    body.rotation.z = Math.PI / 2; body.rotation.y = 0.35; body.position.y = 0.8; hull.add(body);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 7, 6), woodMat());
    mast.position.set(0, 3.6, 0); mast.rotation.z = 0.22; hull.add(mast);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.4, 5), woodMat());
    yard.rotation.z = Math.PI / 2; yard.position.set(0, 5.6, 0); hull.add(yard);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x5a5148, side: THREE.DoubleSide, roughness: 1, transparent: true, opacity: 0.85 }));
    sail.position.set(0, 4.4, 0.05); hull.add(sail);
    hull.position.set(dx, heightAt(dx, dz, seed), dz); scene.add(hull);
    world.colliders.push({ type: 'box', x: dx, z: dz, hx: 5.5, hz: 2.2 });
    world.dockMasts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28 + 0.9, r = 9 + i * 2;
      const x = dx + Math.cos(a) * r, z = dz + Math.sin(a) * r;
      const crane = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 6.5, 6), woodMat());
      post.position.y = 3.25; crane.add(post);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 5), woodMat());
      arm.rotation.z = Math.PI / 2.6; arm.position.set(1.4, 5.6, 0); crane.add(arm);
      const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#cfe0ff', '#4a6aa0'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      lantern.scale.set(0.7, 0.9, 1); lantern.position.set(3.1, 4.4, 0); crane.add(lantern);
      const ll = new THREE.PointLight(0x7fa8ff, 1.1, 10, 2); ll.position.copy(lantern.position); crane.add(ll);
      crane.position.set(x, heightAt(x, z, seed), z); crane.rotation.y = -a;
      scene.add(crane);
      world.colliders.push({ type: 'tree', x, z, r: 0.5 });
      world.dockMasts.push({ group: crane, light: ll, flame: lantern, base: 1.1, phase: rnd() * 6 });
    }
    // лесточные мостки над смогом
    for (let i = 0; i < 5; i++) {
      const a = rnd() * 6.28, r = 5 + rnd() * 9;
      const x = dx + Math.cos(a) * r, z = dz + Math.sin(a) * r;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 0.9), woodMat());
      plank.position.set(x, heightAt(x, z, seed) + 0.5, z); plank.rotation.y = a + Math.PI / 2;
      scene.add(plank);
    }
    // склады люмен-фонарей: ящики со светящейся щелью
    for (let i = 0; i < 4; i++) {
      const x = dx - 7 + (i % 2) * 1.6, z = dz - 6 + Math.floor(i / 2) * 1.4;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.3), woodMat());
      crate.position.set(x, heightAt(x, z, seed) + 0.5, z); crate.rotation.y = rnd(); scene.add(crate);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xa8c8ff }));
      slit.position.set(x, heightAt(x, z, seed) + 0.7, z); slit.rotation.y = crate.rotation.y; scene.add(slit);
      world.colliders.push({ type: 'box', x, z, hx: 0.8, hz: 0.8 });
    }
  }

  // Роща Шепчущих Кострей (grove): зелёные костры + вольеры из веток
  {
    const [gx, gz] = LOCATIONS.grove.anchor.map(v => v * 10);
    world.greenFires = [];
    for (let i = 0; i < 3; i++) {
      const bf = makeBonfire(scene, gx + Math.cos(i * 2.1) * 7, gz + Math.sin(i * 2.1) * 7, seed);
      bf.flame.material.color.setHex(0x55dd88);
      bf.light.color.setHex(0x44cc77);
      world.greenFires.push(bf);
      world.bonfires.push(bf);
    }
    // вольеры химер: частокольца из веток
    for (let i = 0; i < 2; i++) {
      const cx = gx + (i ? 9 : -9), cz = gz + 4;
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * 6.28;
        const x = cx + Math.cos(a) * 3.2, z = cz + Math.sin(a) * 3.2;
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7 + rnd() * 0.6, 5), woodMat());
        branch.position.set(x, heightAt(x, z, seed) + 0.85, z);
        branch.rotation.z = (rnd() - 0.5) * 0.35; branch.rotation.y = a;
        scene.add(branch);
      }
    }
  }

  // Пепельное Поле (ashfields): чёрный монолит, зола, лежбище Надзирателя
  {
    const [fx, fz] = LOCATIONS.ashfields.anchor.map(v => v * 10);
    const monolith = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.35, metalness: 0.5 }));
    monolith.position.set(fx, heightAt(fx, fz, seed) + 3.4, fz);
    monolith.rotation.set(0.06, 0.7, -0.05); scene.add(monolith);
    world.colliders.push({ type: 'box', x: fx, z: fz, hx: 1.0, hz: 1.0 });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#ffe9b8', '#d9b45b'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(6, 9, 1); halo.position.set(fx, heightAt(fx, fz, seed) + 4.2, fz); scene.add(halo);
    // пепелища тлеющих костров Ордена
    for (let i = 0; i < 4; i++) {
      const a = rnd() * 6.28, r = 8 + rnd() * 14;
      const x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r;
      const ash = new THREE.Mesh(new THREE.CircleGeometry(1.6 + rnd(), 12),
        new THREE.MeshStandardMaterial({ color: 0xb8b0a4, roughness: 1 }));
      ash.rotation.x = -Math.PI / 2; ash.position.set(x, heightAt(x, z, seed) + 0.04, z); scene.add(ash);
      const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('#ffb060', '#ff5520'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ember.scale.set(0.8, 0.5, 1); ember.position.set(x, heightAt(x, z, seed) + 0.2, z); scene.add(ember);
      world.embers = world.embers || [];
      world.embers.push(ember);
    }
    // обгоревшие знамёна Ордена
    makeBannerPole(scene, fx + 5, fz - 4, seed, 0x8a7a4a);
    makeBannerPole(scene, fx - 6, fz + 3, seed, 0x6a5a3a);
  }

  // Деревья и камни (с пропуском внутри заставы)
  const treeGroup = new THREE.Group();
  const rockGroup = new THREE.Group();
  let placed = 0, guard = 0;
  while (placed < 130 && guard < 2000) {
    guard++;
    const x = (rnd() - 0.5) * 140, z = (rnd() - 0.5) * 140;
    if (Math.hypot(x, z) < 19) continue;
    if (rnd() < 0.75) treeGroup.add(makeTree(x, z, seed, rnd)); else rockGroup.add(makeRock(x, z, seed, rnd));
    placed++;
    world.colliders.push({ type: 'tree', x, z, r: 0.5 });
  }
  scene.add(treeGroup); scene.add(rockGroup);

  // Знамёна заставы
  world.bannerCloths.push(makeBannerPole(scene, -2, 9, seed, 0x3a5a9a).getObjectByName('cloth'));
  world.bannerCloths.push(makeBannerPole(scene, 2, 12, seed, 0x6a3a8a).getObjectByName('cloth'));

  // Точка возрождения игрока
  world.spawnPoint = { x: 0, z: 6 };

  return world;
}

// Коллизия точки с миром (деревья/постройки) — возвращает скорректированные x,z
export function resolveCollision(x, z, seed, world, radius = 0.5) {
  for (const c of world.colliders) {
    if (c.type === 'box') {
      const nx = THREE.MathUtils.clamp(x, c.x - c.hx, c.x + c.hx);
      const nz = THREE.MathUtils.clamp(z, c.z - c.hz, c.z + c.hz);
      const d = Math.hypot(x - nx, z - nz);
      if (d < radius) {
        const push = radius - d;
        if (d < 1e-4) { x += push; continue; }
        x += ((x - nx) / d) * push; z += ((z - nz) / d) * push;
      }
    } else {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r + radius) {
        const push = c.r + radius - d;
        x += ((x - c.x) / (d || 1)) * push; z += ((z - c.z) / (d || 1)) * push;
      }
    }
  }
  // Граница карты
  const B = 72;
  x = THREE.MathUtils.clamp(x, -B, B); z = THREE.MathUtils.clamp(z, -B, B);
  return { x, z };
}
