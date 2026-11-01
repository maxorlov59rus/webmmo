// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — главный игровой цикл (Three.js r128)
// ============================================================

import * as THREE from '../../vendor/three.module.js';
import { buildWorld, heightAt, resolveCollision } from './world.js';
import { buildHumanoid, buildPlayerMesh, buildMobMesh, buildNpcMesh, AnimController, makeLabel, updateLabelTexture } from './models.js';
import { CombatFX, rollPlayerDamage, rollMobDamage } from './combat.js';
import { NetClient } from './net.js';
import { createCharacter, recalc, gainXp, allocateStat, addItem, removeItem, countItem, equip, unequip, useConsumable, knownAbilities, serialize, deserialize, loadAccount, saveAccount } from './character.js';
import { ITEMS, MOBS, NPCS, ABILITIES, QUESTS, RECIPES, CLASSES, DIALOGS, WORLDS, WORLD_SEED_DEFAULT, LOCATIONS, LOCATION_KEYS, locationById, locationAt, locationsForWorld } from '../data/consts.js';
import { appearanceToMeshOpts } from '../data/appearance.js';
import { UI } from '../ui/hud.js';
import { ServerSync } from '../ui/auth.js';

const rand = (a, b) => a + Math.random() * (b - a);
let mobSeq = 0;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.seed = WORLD_SEED_DEFAULT;
    this.clock = new THREE.Clock();
    this.keys = {};
    this.mobs = [];
    this.remotePlayers = new Map();
    this.npcs = [];
    this.target = null;
    this.time = 0;                 // игровое время, сек
    this.paused = false;
    this.dialogOpen = false;
    this.crafting = null;          // { recipe, t }
    this.deathTimer = 0;
    this.mouseNDC = new THREE.Vector2(0, 0);
    this._ray = new THREE.Raycaster();
    this._planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  // --- Инициализация рендера -------------------------------------------------
  initRender() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.fx = new CombatFX(this.scene, this.camera);
  }

  // --- Старт мира ------------------------------------------------------------
  // opts: { accountEmail, worldId, faction, archetype }
  async start(charName, classId, opts = {}) {
    return this._boot(charName, classId, null, opts);
  }
  async startRestored(savedChar, opts = {}) {
    return this._boot(savedChar.name, savedChar.classId, savedChar, opts);
  }
  async _boot(charName, classId, restored, opts = {}) {
    this.mobDensity = 1;
    this.accountEmail = opts.accountEmail || null;
    const worldDef = WORLDS.find(w => w.id === (opts.worldId || (restored && restored.world)));
    this.worldId = worldDef ? worldDef.id : WORLDS[0].id;
    this.seed = worldDef ? worldDef.seed : WORLD_SEED_DEFAULT;
    this.initRender();
    this.world = buildWorld(this.scene, this.seed);
    if (restored) {
      this.char = restored;
      recalc(this.char);
    } else {
      this.char = createCharacter(charName, classId, this.seed, {
        faction: opts.faction, archetype: opts.archetype, world: this.worldId,
      });
    }
    this.char.world = this.worldId;
    this.ui = new UI(this);
    window.__unequipSlot = (slot) => { unequip(this.char, slot); this.ui.renderInventory(); };

    // месть игрока в мире: сохранённая позиция или точка возрождения заставы
    const sp = this.world.spawnPoint;
    const savedPos = this.char.pos && Math.abs(this.char.pos.x) <= 70 && Math.abs(this.char.pos.z) <= 70 ? this.char.pos : sp;
    this.char.pos = new THREE.Vector3(savedPos.x, heightAt(savedPos.x, savedPos.z, this.seed), savedPos.z);
    const meshOpts = appearanceToMeshOpts(
      this.char.appearance, CLASSES[classId].color,
      classId === 'mage' ? 'staff' : classId === 'scout' ? 'spear' : 'sword',
      this.char.faction);
    this.playerParts = buildHumanoid(meshOpts);
    // подсветка класса под ногами (как у旧 buildPlayerMesh)
    const clsRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: parseInt(CLASSES[classId].color.slice(1), 16), transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    clsRing.rotation.x = -Math.PI / 2; clsRing.position.y = 0.02;
    this.playerParts.root.add(clsRing);
    this.playerAnim = new AnimController(this.playerParts);
    this.playerParts.root.position.copy(this.char.pos);
    this.scene.add(this.playerParts.root);
    this.playerLabel = makeLabel(charName, '', CLASSES[classId].color);
    this.playerLabel.position.y = 2.5;
    this.playerParts.root.add(this.playerLabel);

    // NPC — только жители локаций этого мира
    this.npcDefs = [];
    for (const loc of locationsForWorld(this.worldId)) {
      for (const nid of loc.npcs || []) {
        const npc = NPCS[nid];
        if (!npc || this.npcDefs.includes(npc)) continue;
        this.npcDefs.push(npc);
        const L = LOCATIONS[loc.id];
        const bx = L.anchor[0] * 10, bz = L.anchor[1] * 10;
        npc.x = bx + (npc.offset?.[0] || 0);
        npc.z = bz + (npc.offset?.[1] || 0);
        const parts = buildNpcMesh(npc);
        const y = heightAt(npc.x, npc.z, this.seed);
        parts.root.position.set(npc.x, y, npc.z);
        parts.root.rotation.y = Math.atan2(-npc.x, -npc.z);
        const anim = new AnimController(parts);
        const label = makeLabel(npc.name, npc.role.split('·')[0].trim(), '#ffe9b8');
        label.position.y = 2.6; parts.root.add(label);
        // маркер задания (! или ?)
        const hasQ = (npc.quests || []).length > 0;
        if (hasQ) {
          const mk = makeLabel('!', '', '#ffd24a');
          mk.position.y = 3.4; mk.scale.set(1.2, 0.4, 1);
          parts.root.add(mk);
        }
        this.scene.add(parts.root);
        this.npcs.push({ def: npc, parts, anim, label });
      }
    }

    // Мобы — по локациям мира
    this.spawnInitialMobs();

    // Камера
    this.camYaw = Math.PI; this.camPitch = 0.42; this.camDist = 11;
    this.updateCamera(0);

    // Управление
    this.bindInput();

    // Псевдо-MMO слой
    this.net = new NetClient({ url: parseServerUrl() });
    this.net.on.entitySpawn = (e) => this.onRemoteSpawn(e);
    this.net.on.entityMove = (m) => this.onRemoteMove(m);
    this.net.on.chat = (c) => this.ui.addChat(c.text, c.color, c.author ? `[${c.author}]` : '');
    this.net.on.emote = (e) => this.onRemoteEmote(e);
    this.net.on.disconnect = () => this.ui.addChat('Связь с сервером потеряна. Продолжай в автономном режиме.', '#ff8a8a');
    // ---- ГМ-контур ----
    const gmEmail = (typeof window !== 'undefined' && window.nvrAccount && window.nvrAccount.email) || '';
    this.gmLevel = 0;
    this.net.on.welcome = (w) => {
      if (w && w.gm) {
        this.gmLevel = w.gm;
        this.ui.addChat(`★ Режим администратора: ${w.gmTitle || 'ГМ'} (ур.${w.gm}). /gm help — список команд.`, '#ff8a8a');
        try { const tag = document.querySelector('.char-name-tag'); if (tag) tag.style.color = '#ff5f5f'; } catch (_) {}
      }
      if (w && w.motd) this.ui.addChat(`⚜ ${w.motd}`, '#d9b45b');
    };
    this.net.on.notice = (n) => this.ui.addChat(n.text, '#ffd97a', '[ГМ]');
    this.net.on.announce = (a) => { this.ui.addChat(`⚡ ОБЪЯВЛЕНИЕ: ${a.text}`, '#ff8a8a'); this.ui.toast && this.ui.toast(a.text, 'info'); };
    this.net.on.gmTp = (t) => { if (this.char) { this.char.pos.x = t.x; this.char.pos.z = t.z; this.ui.addChat('Тебя переместил хранитель ночи (ГМ-телепорт).', '#ffd97a'); } };
    this.net.on.gmXp = (x) => { if (this.char && x.amount > 0) { gainXp(this.char, x.amount, this); this.ui.addChat(`Получено ${x.amount} опыта от ГМ.`, '#8fd18f'); } };
    this.net.on.kicked = (k) => { this.ui.addChat(`Выдворен с сервера: ${k.reason || 'причина не указана'}.`, '#ff8a8a'); };
    this.net.on.banned = (b) => { this.ui.addChat(`Аккаунт заблокирован: ${b.reason || 'без причины'}.`, '#ff8a8a'); };
    const mode = await this.net.connect(charName, gmEmail);
    this.ui.addChat(mode === 'live' ? 'Соединение с миром установлено.' : 'Сервер недоступен — локальная симуляция Заставы активна.', '#8fd18f');
    const ss = $('server-status');
    ss.textContent = mode === 'live' ? 'онлайн' : 'симуляция · оффлайн';
    ss.classList.toggle('off', mode !== 'live');

    // Приветствие
    this.ui.addChat('Добро пожаловать на Ночную Заставу. Нажми [H] для справки.', '#ffd98a');
    this.ui.toast(`${charName} · ${CLASSES[classId].name}`, CLASSES[classId].color);

    this.running = true;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  spawnInitialMobs() {
    // Спавн по локациям мира: spawns: [[typeId, count, respawnBonus], ...]
    const placed = [];
    for (const loc of locationsForWorld(this.worldId)) {
      if (!loc.spawns || !loc.spawns.length) continue;
      const cx = loc.anchor[0] * 10, cz = loc.anchor[1] * 10;
      const rad = Math.max(6, (loc.radius || 20) * 0.55);
      for (const [typeId, count, respawnTweak] of loc.spawns) {
        if (!MOBS[typeId]) continue;
        const n = Math.max(1, Math.round((count || 1) * this.mobDensity));
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), r = rand(loc.safe ? 4 : 6, rad);
          const m = this.spawnMob(typeId, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
          m.loc = loc.id;
          if (respawnTweak) m.respawnDelay = Math.max(8, respawnTweak);
          placed.push(m);
        }
      }
    }
    // Страховая «популяция у заставы», если локаций со спавном нет
    if (!placed.length) {
      for (let i = 0; i < 10; i++) {
        const a = rand(0, Math.PI * 2), r = rand(20, 40);
        const m = this.spawnMob('wolf', Math.cos(a) * r, Math.sin(a) * r);
        m.loc = 'outpost';
      }
    }
    // Скелеты у кострищ — классика Ночной Заставы
    for (const bf of this.world.bonfires) {
      const n = 2 + Math.floor(rand(0, 2));
      for (let i = 0; i < n; i++) {
        const px = bf.group.position.x + rand(-5, 5), pz = bf.group.position.z + rand(-5, 5);
        const m = this.spawnMob('skeleton', px, pz);
        m.loc = (locationAt(px, pz) || { id: 'outpost' }).id;
      }
    }
    // Босс локации Пепельного Поля (или дежильная точка, если её нет в мире)
    const ash = locationById('ashfields');
    const bossHome = ash ? { x: ash.anchor[0] * 10, z: ash.anchor[1] * 10 } : { x: -42, z: -38 };
    this.bossHome = bossHome;
    const overseer = this.spawnMob('overseer', bossHome.x, bossHome.z);
    overseer.loc = 'ashfields';
    // Второй босс — Инквизитор Эонглор (квест q_inquisitor), тоже на Пепельном Поле
    if (ash) {
      const inq = this.spawnMob('inquisitor', bossHome.x + 9, bossHome.z - 7);
      inq.loc = 'ashfields';
    }
  }

  // Телепорт к локации (ГМ-команда /tp и кнопка карты)
  teleportToLocation(locId) {
    const L = LOCATIONS[locId] || locationById(locId);
    if (!L) return false;
    const x = L.anchor[0] * 10, z = L.anchor[1] * 10;
    this.char.pos.set(x, heightAt(x, z, this.seed), z);
    if (this.playerParts) this.playerParts.root.position.copy(this.char.pos);
    this.target = null;
    this.updateCamera(0);
    this.ui.toast(`${L.icon} ${L.name}`, L.color);
    this.ui.addChat(`Перемещение: ${L.name} (ур. ${L.levelRange[0]}–${L.levelRange[1]}${L.safe ? ', безопасная зона' : ''}).`, '#ffd97a');
    return true;
  }

  spawnMob(typeId, x, z) {
    const def = MOBS[typeId];
    const m = {
      uid: ++mobSeq, id: typeId, def, name: def.name, level: def.level,
      hp: def.hp, maxHp: def.hp,
      pos: new THREE.Vector3(x, heightAt(x, z, this.seed), z),
      home: new THREE.Vector3(x, 0, z),
      state: 'idle', target: null, attackCd: 0, wanderT: rand(0, 4),
      dead: false, respawnT: 0, slowUntil: 0, stunUntil: 0,
      isBoss: !!def.boss,
    };
    const meshOrParts = buildMobMesh(def.shape);
    // группы-«звери» (без скелета parts.root) трактуются как plain-меши
    if (!meshOrParts || !meshOrParts.root) {
      m.mesh = meshOrParts; m.parts = null; m.anim = null;
    } else {
      m.parts = meshOrParts; m.mesh = meshOrParts.root; m.anim = new AnimController(meshOrParts);
    }
    m.mesh.position.copy(m.pos);
    m.label = makeLabel(def.name, null, def.boss ? '#c07ff0' : '#e8b0a0');
    m.label.position.y = def.shape === 'overseer' ? 4.4 : 2.7;
    m.mesh.add(m.label);
    if (def.boss) {
      m.label.scale.set(3.4, 0.95, 1);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 32), new THREE.MeshBasicMaterial({ color: 0x8a4fd0, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; m.mesh.add(ring);
    }
    this.scene.add(m.mesh);
    this.mobs.push(m);
    return m;
  }

  // --- Ввод -------------------------------------------------------------------
  bindInput() {
    const kd = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      this.keys[e.code] = true;
      const k = e.key.toLowerCase();
      if (['1', '2', '3', '4', '5'].includes(k)) this.castSlot(parseInt(k) - 1);
      if (k === 'q') this.castSlot(5);
      if (k === 'tab') { e.preventDefault(); this.cycleTarget(); }
      if (k === 'f') this.tryInteract();
      if (k === 'i') this.ui.togglePanel('inventory');
      if (k === 'c') this.ui.togglePanel('character');
      if (k === 'k') this.ui.togglePanel('character');   // лист персонажа включает и боевой набор
      if (k === 'j') this.ui.togglePanel('quests');
      if (k === 'b') this.ui.togglePanel('craft');
      if (k === 'm') { e.preventDefault(); this.ui.openGameMenu(); }
      if (k === 'escape') {
        if (!this.ui.closeIfOpen) {}
        if (!$('game-menu').classList.contains('hidden')) { /* UI сам закроет */ }
        else { this.ui.closeDialog(); this.hideForgePanel(); this.target = null; }
      }
    };
    const ku = (e) => { this.keys[e.code] = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    // кнопка «≡ Меню» работает даже когда игра ещё не в фокусе ввода
    $('btn-menu-open').addEventListener('mousedown', (e) => e.stopPropagation());

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.primaryDown = true; this.handleLeftClick(); }
      if (e.button === 2) { this.handleRightClick(); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.primaryDown = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camDist = THREE.MathUtils.clamp(this.camDist + Math.sign(e.deltaY) * 1.2, 5, 26);
    }, { passive: false });
    // ПКМ+перетаскивание = вращение камеры
    let dragging = false, lx = 0, ly = 0;
    this.canvas.addEventListener('mousedown', (e) => { if (e.button === 2) { dragging = true; lx = e.clientX; ly = e.clientY; } });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.camYaw -= (e.clientX - lx) * 0.005;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + (e.clientY - ly) * 0.004, 0.12, 1.15);
      lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  pickOnGround() {
    this._ray.setFromCamera(this.mouseNDC, this.camera);
    const pt = new THREE.Vector3();
    this._planeY.constant = -heightAt(this.char.pos.x, this.char.pos.z, this.seed);
    this._ray.ray.intersectPlane(this._planeY, pt);
    return pt;
  }

  pickMob() {
    this._ray.setFromCamera(this.mouseNDC, this.camera);
    const meshes = this.mobs.filter(m => !m.dead).map(m => m.mesh);
    const hits = this._ray.intersectObjects(meshes, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !meshes.includes(o)) o = o.parent;
    if (!o) return null;
    return this.mobs.find(m => m.mesh === o) || null;
  }

  handleLeftClick() {
    const m = this.pickMob();
    if (m) { this.target = m; this.meleeSwing(); return; }
    // клик по земле — точка движения (клик-то-муув)
    const p = this.pickOnGround();
    if (p && Math.hypot(p.x - this.char.pos.x, p.z - this.char.pos.z) < 40) {
      this.moveGoal = new THREE.Vector3(p.x, 0, p.z);
      this.pingMarker(p);
    }
  }
  handleRightClick() {
    const m = this.pickMob();
    if (m) { this.target = m; }
    // правый клик по земле без цели — cast точки (ночной жар и т.п.) через текущую выбранную способность
    const p = this.pickOnGround();
    if (this.pendingPointAbility && p) {
      this.castAbility(this.pendingPointAbility, p);
      this.pendingPointAbility = null;
    }
  }
  pingMarker(p) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.5, 20), new THREE.MeshBasicMaterial({ color: 0x8fd18f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, heightAt(p.x, p.z, this.seed) + 0.05, p.z);
    this.scene.add(ring);
    this._pings = this._pings || [];
    this._pings.push({ mesh: ring, life: 0.8 });
  }

  cycleTarget() {
    const alive = this.mobs.filter(m => !m.dead && m.pos.distanceTo(this.char.pos) < 30);
    if (!alive.length) { this.target = null; return; }
    alive.sort((a, b) => a.pos.distanceTo(this.char.pos) - b.pos.distanceTo(this.char.pos));
    const idx = this.target ? alive.indexOf(this.target) : -1;
    this.target = alive[(idx + 1) % alive.length];
  }

  tryInteract() {
    if (this.dialogOpen) { this.ui.closeDialog(); return; }
    // NPC рядом?
    for (const n of this.npcs) {
      if (n.parts.root.position.distanceTo(this.char.pos) < 3.2) { this.openNpcDialog(n.def); return; }
    }
    // Кузнечный верстак?
    if (Math.hypot(this.char.pos.x - 6, this.char.pos.z + 4) < 5) { this.openForge(); return; }
  }

  // --- Диалоги и квесты ---------------------------------------------------------
  openNpcDialog(npcDef) {
    this.dialogOpen = true;
    const lines = DIALOGS[npcDef.id] || ['...'];
    const intro = lines[Math.floor(Math.random() * lines.length)];
    const actions = [];
    for (const qid of npcDef.quests || []) {
      const qd = QUESTS.find(q => q.id === qid);
      const active = this.char.quests.find(q => q.id === qid);
      if (!active) {
        actions.push({ label: `Взять задание: «${qd.name}»`, primary: true, onClick: () => { this.acceptQuest(qid); this.ui.closeDialog(); } });
      } else if (active.step >= qd.steps.length - 1 && this.questStepComplete(active)) {
        actions.push({ label: `Сдать задание: «${qd.name}»`, primary: true, onClick: () => { this.completeQuest(qid); this.ui.closeDialog(); } });
      } else {
        actions.push({ label: `Задание «${qd.name}» уже принято`, onClick: () => this.ui.closeDialog() });
      }
    }
    if (npcDef.tutorial) {
      actions.push({ label: 'Обучение: как выковать клинок', onClick: (ui) => {
        ui.showDialog(npcDef, { intro: 'Ночное кузнечное дело просто: собери руду и лунный камень, подйди к горну Дормира и нажми [F]. Что выплавится — то и наденешь.', actions: [] });
      } });
    }
    this.ui.showDialog(npcDef, { intro, actions });
  }

  acceptQuest(qid) {
    if (this.char.quests.some(q => q.id === qid)) return;
    const qd = QUESTS.find(q => q.id === qid);
    this.char.quests.push({ id: qid, step: 0, progress: 0 });
    this.ui.toast(`Принято задание: ${qd.name}`, qd.color);
    this.ui.renderQuests();
  }
  questDef(qid) { return QUESTS.find(q => q.id === qid); }
  questStepComplete(q) {
    const st = this.questDef(q.id).steps[q.step];
    return q.progress >= (st.count || 1);
  }
  onQuestEvent(type, payload) {
    for (const q of this.char.quests) {
      const def = this.questDef(q.id);
      const st = def.steps[q.step];
      if (!st) continue;
      if (st.type === type && ((payload.mob && st.mob === payload.mob) || (payload.item && st.item === payload.item) || (payload.npc && st.npc === payload.npc))) {
        q.progress += payload.count || 1;
        if (q.progress >= (st.count || 1)) {
          q.step++; q.progress = 0;
          this.ui.toast(`Задание «${def.name}»: шаг выполнен`, '#8fd18f');
        }
        this.ui.renderQuests();
      }
    }
  }
  completeQuest(qid) {
    const idx = this.char.quests.findIndex(q => q.id === qid);
    if (idx < 0) return;
    const def = this.questDef(qid);
    const q = this.char.quests[idx];
    if (q.step < def.steps.length - 1 || !this.questStepComplete(q)) return;
    this.char.quests.splice(idx, 1);
    this.char.gold += def.reward.gold;
    for (const it of def.reward.items || []) addItem(this.char, it, 1);
    gainXp(this.char, def.reward.xp, this);
    this.ui.toast(`Задание выполнено: ${def.name} (+${def.reward.xp} опыта, +${def.reward.gold} зол.)`, '#ffd24a');
    this.fx.burst(this.char.pos, 0xffd24a, 24, 5, 0.5, 1.0);
    this.ui.renderQuests();
  }

  // --- Кузница --------------------------------------------------------------------
  openForge() { this.ui.showForge(); this.ui.renderForge(); }
  recipesAvailable() { return RECIPES.filter(r => r.reqLevel <= this.char.level); }
  countItem(id) { return countItem(this.char, id); }
  canCraft(r) { return Object.entries(r.mats).every(([m, n]) => this.countItem(m) >= n); }
  startCraft(r) {
    if (!this.canCraft(r)) return;
    for (const [m, n] of Object.entries(r.mats)) removeItem(this.char, m, n);
    this.crafting = { recipe: r, t: 0 };
    this.ui.renderForge();
    this.ui.addChat('Горн гудит: начинается ночное кузнечное дело...', '#ffb060', '[кузница]');
  }
  finishCraft() {
    const r = this.crafting.recipe;
    addItem(this.char, r.out, 1);
    const def = ITEMS[r.out];
    this.ui.toast(`Выковано: ${def.name}`, ['#c8c8c8', '#6fd36f', '#5aa9ff', '#c07ff0', '#ffb64a'][def.rarity]);
    this.fx.burst(this.char.pos, 0xff8840, 20, 4, 0.4, 0.9);
    this.crafting = null;
    this.ui.renderForge();
  }

  // --- Предметы ----------------------------------------------------------------------
  useOrEquipFromInventory(i) {
    const s = this.char.inventory[i]; if (!s) return;
    const def = ITEMS[s.id];
    if (def.use) { useConsumable(this.char, i, this); this.ui.addChat(`Использовано: ${def.name}`, '#8fd18f'); }
    else if (def.slot !== 'none') { equip(this.char, i); this.ui.addChat(`Экипировано: ${def.name}`, '#8fd18f'); }
    this.ui.renderInventory();
  }
  allocateStat(k) { allocateStat(this.char, k); }
  knownAbilities() { return knownAbilities(this.char); }

  // --- Бои ---------------------------------------------------------------------------
  meleeSwing() {
    if (this.playerAnim.state === 'attack' || this.char.hp <= 0) return;
    this.playerAnim.triggerAttack(0.45 * this.char.stats.speedMul);
    const t = this.target;
    if (t && !t.dead && this.char.pos.distanceTo(t.pos) <= this.char.stats.reach + 1.1) {
      setTimeout(() => {
        if (!t || t.dead) return;
        const r = rollPlayerDamage(this.char.stats);
        this.damageMob(t, r.dmg, { crit: r.crit });
      }, 220);
    }
  }

  castSlot(i) {
    const acts = this.knownAbilities().filter(a => a.kind === 'active');
    const ab = acts[i];
    if (!ab) return;
    if (ab.target === 'point' && !this.target) {
      this.pendingPointAbility = ab.id;
      this.ui.addChat('Кликни правой кнопкой по земле — укажи точку заклинания.', '#b8c4d8');
      return;
    }
    this.castAbility(ab.id);
  }

  isAbilityReady(id) { return this.cooldownLeft(id) <= 0; }
  cooldownLeft(id) { return Math.max(0, (this.char.cooldowns[id] || 0) - this.time); }

  castAbility(id, pointOverride) {
    const ab = ABILITIES[id];
    if (!ab || ab.kind !== 'active') return;
    if (!this.isAbilityReady(id)) { this.ui.addChat(`${ab.name}: ещё не готово`, '#e0a050'); return; }
    if (this.char.mp < (ab.cost.mp || 0)) { this.ui.addChat('Недостаточно маны', '#7aa0ff'); return; }
    const c = this.char, s = c.stats;
    this.char.mp -= ab.cost.mp || 0;
    this.char.cooldowns[id] = this.time + ab.cd;

    switch (id) {
      case 'cleave': case 'volley': {
        this.playerAnim.triggerAttack(0.6);
        const hits = this.mobs.filter(m => !m.dead && m.pos.distanceTo(c.pos) <= ab.radius);
        for (const m of hits) {
          const r = rollPlayerDamage(s, ab.power(s) / s.dmgBase);
          this.damageMob(m, r.dmg, { crit: r.crit });
        }
        this.fx.burst(c.pos, clsColorHex(c.classId), hits.length ? 16 : 6, 4, 0.4, 0.6);
        break;
      }
      case 'bulwark': {
        c.buffs.push({ type: 'shield', ratio: ab.effect.ratio, until: this.time + ab.duration });
        recalc(c);
        this.ui.addChat('Бастион! Щит поглощает урон.', '#8fd18f');
        this.fx.burst(c.pos, 0x7fa8d9, 14, 3, 0.5, 0.8);
        break;
      }
      case 'spark': case 'frostlance': case 'precise': {
        const t = this.target;
        if (!t || t.dead || c.pos.distanceTo(t.pos) > ab.range) { this.ui.addChat('Цель вне досяжности', '#e0a050'); return; }
        this.playerAnim.setState('cast');
        setTimeout(() => this.playerAnim.setState('idle'), 400);
        const dmg = Math.max(1, Math.round(ab.power(s) * rand(0.9, 1.1)));
        const crit = Math.random() * 100 < s.crit + (ab.effect?.value || 0);
        this.fx.launchProjectile(c.pos, t, {
          damage: crit ? Math.round(dmg * 1.8) : dmg, crit,
          color: id === 'frostlance' ? 0x60c0ff : id === 'precise' ? 0x8fd18f : 0xb060ff,
          speed: ab.projSpeed, effect: ab.effect,
          onHit: (target, d, cr, eff) => {
            if (target.dead) return;
            this.damageMob(target, d, { crit: cr });
            if (eff?.type === 'slow') target.slowUntil = this.time + eff.duration;
          },
        });
        break;
      }
      case 'nightfire': {
        const p = pointOverride || (this.target ? this.target.pos : this.pickOnGround());
        if (!p || c.pos.distanceTo(p) > ab.range) { this.ui.addChat('Слишком далеко', '#e0a050'); return; }
        const dps = ab.power(s);
        this.fx.addZone(new THREE.Vector3(p.x, heightAt(p.x, p.z, this.seed), p.z), ab.radius, 0xff6a2a, { dps, ttl: ab.duration });
        break;
      }
      case 'shadowstep': {
        const p = pointOverride || this.pickOnGround();
        if (!p) return;
        const dist = Math.min(ab.range, Math.hypot(p.x - c.pos.x, p.z - c.pos.z));
        const dir = new THREE.Vector3(p.x - c.pos.x, 0, p.z - c.pos.z).normalize();
        const np = resolveCollision(c.pos.x + dir.x * dist, c.pos.z + dir.z * dist, this.seed, this.world);
        this.fx.burst(c.pos, 0x2a1a4a, 12, 3, 0.5, 0.5);
        c.pos.set(np.x, heightAt(np.x, np.z, this.seed), np.z);
        for (const m of this.mobs) if (!m.dead && m.pos.distanceTo(c.pos) < 3) m.stunUntil = this.time + ab.effect.duration;
        this.fx.burst(c.pos, 0x6a3fa0, 14, 3, 0.5, 0.6);
        break;
      }
    }
  }

  damageMob(m, amount, opts = {}) {
    if (m.dead) return;
    m.hp -= amount;
    m.lastHitByPlayer = true;
    m.label && updateLabelTexture(m.label, `${m.name}`, m.hp / m.maxHp, m.isBoss ? '#c07ff0' : '#e8b0a0');
    this.fx.floatText(m.pos, String(amount), opts.crit ? '#ffd24a' : '#ffffff', opts.crit);
    if (opts.crit) this.fx.shakeScreen(0.25);
    if (m.state === 'idle') { m.state = 'chase'; m.target = 'player'; }
    if (m.hp <= 0) this.killMob(m);
  }

  killMob(m) {
    m.dead = true; m.hp = 0;
    if (m.anim) m.anim.kill(); else m.mesh.userData.dying = true;
    m.respawnT = this.time + (m.respawnDelay || m.def.respawn);
    this.fx.burst(m.pos, m.isBoss ? 0x8a4fd0 : 0x88aaff, 20, 4, 0.5, 0.9);
    // опыт/золото
    const xp = Math.max(1, Math.round(m.def.xp * THREE.MathUtils.clamp(1 - 0.12 * (this.char.level - m.level), 0.3, 1.2)));
    const gold = Math.round(rand(m.def.gold[0], m.def.gold[1]));
    this.char.gold += gold;
    gainXp(this.char, xp, this);
    this.ui.addChat(`Повержен: ${m.name}. +${xp} опыта, +${gold} зол.`, '#cfd6e4');
    // лут
    const got = [];
    for (const [iid, ch] of m.def.loot) {
      if (Math.random() < ch * (1 + this.char.stats.wit * 0.01)) {
        addItem(this.char, iid, 1);
        got.push(ITEMS[iid]);
      }
    }
    if (got.length) { this.ui.lootPopup(got); this.ui.addChat('Добыча: ' + got.map(g => g.name).join(', '), '#8fd18f'); }
    // квесты
    this.onQuestEvent('kill', { mob: m.id, count: 1 });
    this.char.kills[m.id] = (this.char.kills[m.id] || 0) + 1;
    if (this.target === m) this.target = null;
    if (m.isBoss) {
      this.ui.toast('Надзиратель Ночи пал! Застава свободна до рассвета.', '#ffb64a');
      this.fx.burst(m.pos, 0xffd24a, 40, 6, 0.7, 1.4);
    }
  }

  damagePlayer(amount, source) {
    const c = this.char;
    c.hp -= amount;
    this.fx.floatText(c.pos, '-' + amount, '#ff6a6a');
    this.fx.shakeScreen(0.35);
    this.playerAnim.triggerHit();
    if (c.hp <= 0) this.playerDie();
    this.saveSoon();
  }

  playerDie() {
    this.char.hp = 0;
    this.deathTimer = this.time;
    this.ui.showDeath();
    this.ui.addChat('Ты пал этой ночью. Застава скорбит недолго.', '#ff8a8a');
  }
  respawn() {
    const sp = this.world.spawnPoint;
    this.char.pos.set(sp.x, heightAt(sp.x, sp.z, this.seed), sp.z);
    this.char.hp = Math.round(this.char.stats.maxHp * 0.5);
    this.char.mp = Math.round(this.char.stats.maxMp * 0.5);
    this.target = null;
    this.ui.hideDeath();
  }

  onLevelUp(c) {
    this.ui.toast(`Уровень ${c.level}! +3 очка характеристик`, '#ffd24a');
    this.fx.burst(c.pos, 0xffd24a, 30, 5, 0.6, 1.2);
    this.ui.renderSpells();
    this.ui.updateCooldownBar();
  }

  // --- Сеть: удалённые игроки -----------------------------------------------------
  onRemoteSpawn(e) {
    if (e.kind !== 'player') return;
    const parts = buildPlayerMesh(e.cls || 'warden', e.color || '#7fa8d9');
    parts.root.position.set(e.x, heightAt(e.x, e.z, this.seed), e.z);
    const anim = new AnimController(parts);
    const label = makeLabel(e.name, `ур.${e.level}`, e.color);
    label.position.y = 2.5; parts.root.add(label);
    this.scene.add(parts.root);
    this.remotePlayers.set(e.id, { parts, anim, label, targetPos: parts.root.position.clone(), emoteT: 0 });
  }
  onRemoteMove(m) {
    const rp = this.remotePlayers.get(m.id); if (!rp) return;
    rp.targetPos.set(m.x, heightAt(m.x, m.z, this.seed), m.z);
    rp.rot = m.r;
  }
  onRemoteEmote(e) {
    const rp = this.remotePlayers.get(e.id); if (!rp) return;
    rp.emoteT = 1.6;
    const map = { 'поклон': 'кланяется', 'крик': 'кричит от радости', 'смех': 'смеётся', 'драться': 'замахивается', 'танец': 'пляшет', 'присесть': 'приседает' };
    this.fx.floatText(rp.parts.root.position, map[e.name] || e.name, '#b8c4d8');
  }

  sendChat(text) {
    if (text.startsWith('/')) {
      const cmd = text.slice(1).trim();
      // --- ГМ-команды ---
      if (cmd.startsWith('gm ')) { this.gmCommand(cmd.slice(3)); return; }
      if (cmd.startsWith('tp ') || cmd === 'tp') {
        const arg = cmd.slice(2).trim();
        if (this.gmLevel >= 2) { this.doTp(arg); return; }
        this.ui.addChat('«/tp» — привилегия хранителей ночи (ГМ 2+).', '#ff8a8a');
        return;
      }
      const known = ['поклон', 'крик', 'смех', 'драться', 'танец', 'присесть'];
      const em = known.find(k => cmd.startsWith(k));
      if (em) { this.ui.addChat(`${this.char.name} ${cmd}`, '#b8c4d8', '/эмоция'); this.net.sendEmote(em); this.fx.floatText(this.char.pos, em, '#b8c4d8'); return; }
      // неизвестная слэш-команда: если есть соединение — пробуем отправить как ГМ-команду ядру
      if (this.net && this.net.mode === 'live') { this.net.sendChat(text); return; }
    }
    this.ui.addChat(text, '#ffffff', `[${this.char.name}]`);
    this.net.sendChat(text);
  }

  doTp(arg) {
    // /tp <локация|номер|игрок>
    if (!arg) {
      const list = LOCATION_KEYS.map((k, i) => `${i + 1}) ${LOCATIONS[k].name}`).join(' · ');
      this.ui.addChat(`Куда телепортировать? /tp <№|имя>: ${list}`, '#ffd97a');
      return;
    }
    const idx = parseInt(arg, 10);
    let locId = null;
    if (!isNaN(idx) && LOCATION_KEYS[idx - 1]) locId = LOCATION_KEYS[idx - 1];
    else {
      const q = arg.toLowerCase();
      locId = LOCATION_KEYS.find(k => k === q || LOCATIONS[k].name.toLowerCase().includes(q)) || null;
    }
    if (locId && this.teleportToLocation(locId)) return;
    // телепорт к игроку (удалённый или локальный «бот»)
    const rp = [...(this.remotePlayers ? this.remotePlayers.values() : [])]
      .find(r => r.name && r.name.toLowerCase().startsWith(q));
    if (rp) {
      const p = rp.targetPos || rp.parts.root.position;
      this.char.pos.set(p.x, heightAt(p.x, p.z, this.seed), p.z);
      this.playerParts.root.position.copy(this.char.pos);
      this.updateCamera(0);
      this.ui.addChat(`Телепорт к ${rp.name}.`, '#ffd97a');
      return;
    }
    this.ui.addChat(`Неизвестная локация или игрок: «${arg}».`, '#ff8a8a');
  }

  gmCommand(raw) {
    const parts = raw.split(/\s+/);
    const c0 = (parts[0] || '').toLowerCase();
    if (c0 === 'help') {
      this.ui.addChat('ГМ: /gm kick <им> · /gm ban <им> [причина] · /gm unban <им> · /gm announce <текст> · /gm notice <текст> · /gm xp <кол-во> [им] · /gm tp <локация|им> · /gm spawn <моб> [кол-во] · /gm locs · /gm who · /gm audit', '#ff9a9a');
      return;
    }
    if (c0 === 'locs') {
      for (const k of LOCATION_KEYS) {
        const L = LOCATIONS[k];
        this.ui.addChat(`${L.icon} ${L.name} — ур. ${L.levelRange[0]}–${L.levelRange[1]}, мобов в спавне: ${(L.spawns || []).reduce((s, x) => s + (x[1] || 1), 0)}, NPC: ${(L.npcs || []).length}${L.safe ? ' [безопасно]' : ''}`, '#b8c4d8');
      }
      return;
    }
    if (c0 === 'tp') { this.doTp(parts.slice(1).join(' ')); return; }
    if (c0 === 'spawn') {
      const typeId = parts[1];
      const n = Math.min(20, parseInt(parts[2] || '1', 10) || 1);
      if (!MOBS[typeId]) { this.ui.addChat(`Нет такого моба: ${typeId}. Есть: ${Object.keys(MOBS).join(', ')}`, '#ff8a8a'); return; }
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.28), r = rand(4, 9);
        this.spawnMob(typeId, this.char.pos.x + Math.cos(a) * r, this.char.pos.z + Math.sin(a) * r);
      }
      this.ui.addChat(`Заселено: ${MOBS[typeId].name} ×${n}.`, '#ffd97a');
      return;
    }
    if (['kick', 'ban', 'unban', 'announce', 'notice', 'xp'].includes(c0)) {
      // эти команды уходят на ядро сервера (там проверяются права и пишется audit_log)
      if (this.net && this.net.mode === 'live') {
        this.net.sendChat('/gm ' + raw);
        this.ui.addChat('Команда отправлена ядру сервера.', '#b8c4d8');
      } else {
        this.ui.addChat('Сервер не подключен — ГМ-команды управления доступны только в live-режиме (?api=...).', '#ff8a8a');
      }
      return;
    }
    if (c0 === 'who' || c0 === 'audit') {
      if (this.net && this.net.mode === 'live') { this.net.sendChat('/gm ' + c0); this.ui.addChat(`Запрос «${c0}» отправлен ядру.`, '#b8c4d8'); }
      else this.ui.addChat('Локальная симуляция: список онлайн недоступен без сервера.', '#ff8a8a');
      return;
    }
    this.ui.addChat(`Неизвестная ГМ-команда: /gm ${c0}. Список: /gm help`, '#ff8a8a');
  }

  // --- Главный цикл ------------------------------------------------------------------
  loop() {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.paused) this.update(dt);
    this.fx.update(dt, this);
    // тряска
    if (this.fx.shake > 0) {
      this.camera.position.x += rand(-1, 1) * this.fx.shake * 0.15;
      this.camera.position.y += rand(-1, 1) * this.fx.shake * 0.15;
    }
    this.renderer.render(this.scene, this.camera);
    this._hudAcc = (this._hudAcc || 0) + dt;
    if (this._hudAcc > 0.1) {
      this._hudAcc = 0;
      this.ui.updateHud();
      this.ui.updateCooldownBar();
    }
  }

  update(dt) {
    this.time += dt;
    const c = this.char;

    // регенерация
    if (c.hp > 0) {
      c.hp = Math.min(c.stats.maxHp, c.hp + dt * (1 + c.stats.ward * 0.08));
      c.mp = Math.min(c.stats.maxMp, c.mp + dt * (2 + c.stats.arcane * 0.15));
    }
    // баффы
    for (let i = c.buffs.length - 1; i >= 0; i--) if (c.buffs[i].until <= this.time) c.buffs.splice(i, 1);
    recalc(c);

    // крафт
    if (this.crafting) {
      this.crafting.t += dt;
      if (this.crafting.t >= this.crafting.recipe.time) this.finishCraft();
    }

    // движение игрока
    if (c.hp > 0 && !this.dialogOpen) {
      let mx = 0, mz = 0;
      if (this.keys.KeyW || this.keys.ArrowUp) mz -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) mz += 1;
      if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
      // WASD относительно камеры
      const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      let vel = new THREE.Vector3().addScaledVector(fwd, -mz).addScaledVector(right, mx);
      if (this.moveGoal) {
        const to = new THREE.Vector3(this.moveGoal.x - c.pos.x, 0, this.moveGoal.z - c.pos.z);
        if (to.length() < 0.6) this.moveGoal = null;
        else vel.add(to.normalize().multiplyScalar(1));
      }
      const sprint = this.keys.ShiftLeft ? 1.5 : 1;
      const speed = c.stats.moveSpeed * (1 + c.stats.passives.speedBonus / 100) * sprint;
      if (vel.lengthSq() > 0.01) {
        vel.normalize().multiplyScalar(speed * dt);
        const res = resolveCollision(c.pos.x + vel.x, c.pos.z + vel.z, this.seed, this.world);
        c.pos.set(res.x, heightAt(res.x, res.z, this.seed), res.z);
        c.pos.y = heightAt(c.pos.x, c.pos.z, this.seed);
        const face = Math.atan2(vel.x, vel.z);
        this.playerParts.root.rotation.y = lerpAngle(this.playerParts.root.rotation.y, face, 0.25);
        if (this.playerAnim.state !== 'attack') this.playerAnim.setState('walk');
      } else {
        if (this.playerAnim.state !== 'attack') this.playerAnim.setState('idle');
      }
      this.playerParts.root.position.copy(c.pos);
      this.playerAnim.update(dt);
      // автоатака при зажатой ЛКМ
      if (this.primaryDown) this.meleeSwing();
      // дистанционная автоатака магам при зажатой ЛКМ на цели
      if (this.primaryDown && c.classId === 'mage' && this.target && !this.target.dead) {
        this._autoCast = this._autoCast || 0;
        if (this.time - this._autoCast > 1.1 && this.isAbilityReady('spark')) { this._autoCast = this.time; this.castAbility('spark'); }
      }
      // сеть: шлём позицию ~8 раз/сек
      this._netAcc = (this._netAcc || 0) + dt;
      if (this._netAcc > 0.125) { this._netAcc = 0; this.net.sendMove(c.pos.x, c.pos.z, this.playerParts.root.rotation.y); }
      // проверка близости для подсказки [F]
      this.nearNpc = null; this.nearInteract = null;
      for (const n of this.npcs) if (n.parts.root.position.distanceTo(c.pos) < 3.2) { this.nearNpc = n.def; this.nearInteract = { label: `Говорить: ${n.def.name}` }; }
      if (!this.nearNpc && Math.hypot(c.pos.x - 6, c.pos.z + 4) < 5) this.nearInteract = { label: 'Кузнечный горн' };
      // прогресс квестов "собери предмет"
      for (const q of c.quests) {
        const def = this.questDef(q.id);
        const st = def.steps[q.step];
        if (st && st.type === 'collect') {
          const have = countItem(c, st.item);
          if (have >= (st.count || 1) && q.progress < (st.count || 1)) {
            q.progress = st.count || 1;
            q.step++; q.progress = 0;
            this.ui.toast(`Задание «${def.name}»: шаг выполнен`, '#8fd18f');
            this.ui.renderQuests();
          }
        }
      }
    }

    // интеракт-подсветка NPC
    for (const n of this.npcs) n.anim.update(dt);

    // удалённые игроки — плавная интерполяция
    for (const rp of this.remotePlayers.values()) {
      const cur = rp.parts.root.position;
      const d = cur.distanceTo(rp.targetPos);
      if (d > 0.05) {
        cur.lerp(rp.targetPos, Math.min(1, dt * 8));
        rp.parts.root.rotation.y = rp.rot != null ? lerpAngle(rp.parts.root.rotation.y, rp.rot, 0.2) : rp.parts.root.rotation.y;
        rp.anim.setState('walk');
      } else rp.anim.setState('idle');
      cur.y = heightAt(cur.x, cur.z, this.seed);
      rp.anim.update(dt);
    }

    // мобы
    for (const m of this.mobs) this.updateMob(m, dt);

    // респаун убитых мобов
    for (const m of this.mobs) {
      if (m.dead && this.time >= m.respawnT) {
        m.dead = false; m.hp = m.maxHp;
        m.pos.copy(m.home);
        m.state = 'idle';
        if (m.anim) { m.anim.dead = false; m.anim.deathT = 0; m.anim.state = 'idle'; m.mesh.rotation.x = 0; m.mesh.position.y = m.pos.y; }
        else { m.mesh.userData.dying = false; m.mesh.visible = true; m.mesh.position.copy(m.pos); }
        updateLabelTexture(m.label, m.name, 1, m.isBoss ? '#c07ff0' : '#e8b0a0');
      }
    }

    // маркеры клика
    if (this._pings) {
      for (let i = this._pings.length - 1; i >= 0; i--) {
        const p = this._pings[i];
        p.life -= dt;
        p.mesh.material.opacity = Math.max(0, p.life);
        p.mesh.scale.setScalar(1 + (0.8 - p.life) * 2);
        if (p.life <= 0) { this.scene.remove(p.mesh); this._pings.splice(i, 1); }
      }
    }

    // знамёна колышутся
    for (const cloth of this.world.bannerCloths) {
      cloth.rotation.y = Math.sin(this.time * 1.7 + cloth.position.x) * 0.25;
    }
    // огонь мерцает
    for (const t of this.world.torches) {
      const f = t.base + Math.sin(this.time * 9 + t.phase) * 0.25 + rand(-0.05, 0.05);
      t.light.intensity = f;
      t.flame.scale.y = 0.9 + (f - t.base) * 0.4;
    }
    for (const bf of this.world.bonfires) {
      bf.light.intensity = bf.base + Math.sin(this.time * 6) * 0.4 + rand(-0.1, 0.1);
      bf.flame.scale.y = 2.0 + Math.sin(this.time * 7) * 0.3;
    }
    // анимация локаций: подъёмник, пар, фонари причалов, тлеющая зола
    if (this.world.mineWheel) {
      this.world.mineWheel.rotation.z = this.time * 0.9;
      if (this.world.mineCage) this.world.mineCage.position.y = 1.2 + Math.sin(this.time * 0.55) * 1.1;
    }
    if (this.world.steam) {
      const s = (this.time * 0.7) % 1;
      this.world.steam.material.opacity = 0.5 * (1 - s);
      this.world.steam.position.y += 0.012;
      if (s < 0.02) this.world.steam.userData = null;
    }
    for (const dm of (this.world.dockMasts || [])) {
      dm.light.intensity = dm.base + Math.sin(this.time * 5 + dm.phase) * 0.3;
    }
    for (const em of (this.world.embers || [])) {
      em.material.opacity = 0.55 + Math.sin(this.time * 3 + em.position.x) * 0.35;
    }
    // подсветка цели
    for (const m of this.mobs) {
      if (m.parts && m.parts.selectRing) m.parts.selectRing.visible = false;
    }
    if (this.target && !this.target.dead) {
      if (!this.target.selRing) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(this.target.isBoss ? 1.7 : 0.8, this.target.isBoss ? 2.0 : 1.0, 28),
          new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);
        this.target.selRing = ring;
      }
      this.target.selRing.visible = true;
      this.target.selRing.position.set(this.target.pos.x, this.target.pos.y + 0.06, this.target.pos.z);
      this.target.selRing.rotation.z = this.time * 1.5;
    }
    if (this.target && this.target.dead && this.target.selRing) {
      this.scene.remove(this.target.selRing); this.target.selRing = null;
    }

    this.updateCamera(dt);
    // автосохранение
    this._saveAcc = (this._saveAcc || 0) + dt;
    if (this._saveAcc > 10) { this._saveAcc = 0; this.save(); }
  }

  updateMob(m, dt) {
    if (m.dead) return;
    const c = this.char;
    const stunned = m.stunUntil > this.time;
    const slowed = m.slowUntil > this.time;
    const speedMul = slowed ? 0.5 : 1;
    const distP = m.pos.distanceTo(c.pos);

    // ИИ
    if (!stunned) {
      if (m.state === 'idle' || m.state === 'wander') {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = rand(2, 5);
          const a = rand(0, Math.PI * 2), r = rand(2, 7);
          m.wanderTo = new THREE.Vector3(m.home.x + Math.cos(a) * r, 0, m.home.z + Math.sin(a) * r);
        }
        if (m.wanderTo) {
          const d = Math.hypot(m.wanderTo.x - m.pos.x, m.wanderTo.z - m.pos.z);
          if (d > 0.4) {
            this.moveMob(m, m.wanderTo.x, m.wanderTo.z, m.def.speed * 0.4 * speedMul, dt);
            if (m.anim) m.anim.setState('walk');
          } else if (m.anim) m.anim.setState('idle');
        }
        if (distP < m.def.aggro && c.hp > 0) { m.state = 'chase'; }
      } else if (m.state === 'chase') {
        if (distP > m.def.aggro * 1.9) { m.state = 'return'; }
        else if (distP <= m.def.attackRange) { m.state = 'attack'; }
        else {
          this.moveMob(m, c.pos.x, c.pos.z, m.def.speed * speedMul, dt);
          if (m.anim) m.anim.setState('walk');
        }
      } else if (m.state === 'attack') {
        if (m.anim) m.anim.setState('idle');
        if (distP > m.def.attackRange * 1.3) { m.state = 'chase'; return; }
        m.attackCd -= dt;
        if (m.attackCd <= 0) {
          m.attackCd = 1.6 + rand(0, 0.8);
          if (m.anim) m.anim.triggerAttack(0.5);
          setTimeout(() => {
            if (m.dead || c.hp <= 0) return;
            if (m.pos.distanceTo(c.pos) > m.def.attackRange * 1.6) return;
            const r = rollMobDamage(m, c.stats);
            if (r.blocked) this.fx.floatText(c.pos, 'Блок!', '#8fb4e8');
            else if (r.shielded) this.fx.floatText(c.pos, String(r.dmg), '#b8c4d8');
            else this.fx.floatText(c.pos, '-' + r.dmg, '#ff6a6a');
            if (!r.blocked) this.damagePlayer(r.dmg, m);
          }, 260);
        }
      } else if (m.state === 'return') {
        const d = Math.hypot(m.home.x - m.pos.x, m.home.z - m.pos.z);
        if (d > 0.5) {
          this.moveMob(m, m.home.x, m.home.z, m.def.speed * speedMul, dt);
          if (m.anim) m.anim.setState('walk');
          m.hp = Math.min(m.maxHp, m.hp + dt * m.maxHp * 0.15);
          updateLabelTexture(m.label, m.name, m.hp / m.maxHp, m.isBoss ? '#c07ff0' : '#e8b0a0');
        } else { m.state = 'idle'; }
      }
    }

    // анимации неногочей (волк/тень)
    if (!m.anim) {
      const ud = m.mesh.userData;
      if (ud.legs) {
        const w = (m.state === 'chase' || m.state === 'wander') ? this.time * 10 : this.time * 2;
        ud.legs.forEach((l, i) => { l.rotation.x = Math.sin(w + i * Math.PI / 2) * (m.state === 'chase' ? 0.6 : 0.1); });
        if (ud.tail) ud.tail.rotation.y = Math.sin(this.time * 3) * 0.4;
      }
      if (ud.isShade) {
        m.mesh.position.y = m.pos.y + Math.sin(this.time * 2 + m.uid) * 0.15;
        if (ud.aura) ud.aura.material.opacity = 0.35 + Math.sin(this.time * 5) * 0.15;
      }
      if (ud.dying) {
        m.mesh.scale.y = Math.max(0.05, m.mesh.scale.y - dt * 1.5);
        m.mesh.visible = m.mesh.scale.y > 0.06;
      } else if (m.mesh.scale.y < 1) { m.mesh.scale.y = 1; m.mesh.visible = true; }
    } else {
      m.anim.update(dt);
      if (m.anim.dead) m.mesh.visible = m.anim.deathT < 1.2;
    }
    m.mesh.position.x = m.pos.x; m.mesh.position.z = m.pos.z;
    if (m.pos.y !== undefined) m.mesh.position.y = m.pos.y;
  }

  moveMob(m, tx, tz, speed, dt) {
    const dx = tx - m.pos.x, dz = tz - m.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = m.pos.x + (dx / d) * speed * dt;
    const nz = m.pos.z + (dz / d) * speed * dt;
    const res = resolveCollision(nx, nz, this.seed, this.world, 0.4);
    m.pos.set(res.x, heightAt(res.x, res.z, this.seed), res.z);
    const rot = Math.atan2(dx, dz);
    m.mesh.rotation.y = lerpAngle(m.mesh.rotation.y, rot, 0.2);
  }

  updateCamera(dt) {
    const c = this.char ? this.char.pos : new THREE.Vector3();
    const h = heightAt(c.x, c.z, this.seed);
    const cx = c.x - Math.sin(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cz = c.z - Math.cos(this.camYaw) * this.camDist * Math.cos(this.camPitch);
    const cy = h + this.camDist * Math.sin(this.camPitch) + 1.2;
    this.camera.position.lerp(new THREE.Vector3(cx, Math.max(cy, h + 1.5), cz), Math.min(1, dt * 8));
    this.camera.lookAt(c.x, h + 1.3, c.z);
  }

  save() {
    const json = serialize(this.char);
    try { localStorage.setItem('nvr_save', json); } catch (_) {}
    // персист в аккаунт-прототипе: персонаж привязан к worldId учётки
    if (this.accountEmail) {
      try {
        const acc = loadAccount(this.accountEmail);
        if (acc) { acc.characters[this.worldId] = json; acc.lastWorld = this.worldId; saveAccount(acc); }
      } catch (_) {}
    }
    // синхронизация с серверной БД (если игра запущена с ?api=)
    if (ServerSync.enabled && !this._syncBusy) {
      this._syncBusy = true;
      ServerSync.upload(this.worldId, json).then((ok) => { this._lastSyncOk = ok; }).finally(() => { this._syncBusy = false; });
    }
  }
  saveSoon() { clearTimeout(this._saveT); this._saveT = setTimeout(() => this.save(), 1500); }
  static loadSaved() { return deserialize(localStorage.getItem('nvr_save')); }
}

function clsColorHex(classId) { return parseInt(CLASSES[classId].color.slice(1), 16); }
function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
function parseServerUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('server')) return p.get('server');
  // авто-детект: если страница открыта с игрового сервера (Express отдаёт клиент) — идём на его /ws
  if (!p.get('api') && /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.protocol.startsWith('http')) {
    try {
      const r = await_probe();
      if (r) return r;
    } catch (_) {}
  }
  return null;
}
// синхронная проверка наличия WS-эндпоинта невозможна — вместо этого пробуем подключиться к тому же хосту,
// если HTTP-запрос /api/ping успешен (делаем это один раз при старте)
let _autoWs = undefined;
function await_probe() {
  if (_autoWs !== undefined) return _autoWs;
  // лениво: предполагаем ws://<host>:<port>/ws и даём NetClient шанс (он откатится в симуляцию при ошибке)
  _autoWs = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  return _autoWs;
}
