// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — псевдо-сетевой слой (WebSocket + симуляция)
//  Реальный сервер опционален; без него клиент разворачивает локальную
//  симуляцию мира и ботов, чтобы MMO ощущалась «как настоящая».
// ============================================================

const PROTO = {
  HELLO: 'hello', WELCOME: 'welcome', SPAWN: 'spawn', DESPAWN: 'despawn',
  MOVE: 'move', CHAT: 'chat', EMOTE: 'emote', STATE: 'state', PING: 'ping',
};

const BOT_NAMES = [
  'Strannik', 'Vedma_Kira', 'Grom', 'Luna_V', 'Ratobor', 'Zima', 'Iskra',
  'Volk_odinočkiy', 'Yaroslav', 'Mglа', 'Koshеy_Bagrovyy', 'Serafima',
];
const BOT_CLASSES = ['warden', 'mage', 'scout'];
const BOT_COLORS = { warden: '#7fa8d9', mage: '#b48ce8', scout: '#8fd18f' };

export class NetClient {
  constructor(opts = {}) {
    this.url = opts.url || null;          // ws://host:port — если задан, идём на реальный сервер
    this.on = {};                          // обработчики событий мира
    this.ws = null;
    this.mode = 'offline';                 // offline | live
    this.connectedAt = 0;
    this._botTimer = null;
    this._simTimer = null;
    this._bots = new Map();
    this._t = 0;
  }

  emit(ev, payload) { if (this.on[ev]) this.on[ev](payload); }

  connect(selfName, email) {
    this.email = email || '';
    return new Promise((resolve) => {
      if (!this.url) { this._startLocalSim(selfName); resolve('offline'); return; }
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        this._startLocalSim(selfName); resolve('offline'); return;
      }
      const to = setTimeout(() => {           // сервер молчит — уходим в симуляцию
        if (this.mode === 'connecting') { try { this.ws.close(); } catch (_) {} this._startLocalSim(selfName); resolve('offline'); }
      }, 2500);
      this.mode = 'connecting';
      this.ws.onopen = () => {
        clearTimeout(to);
        this.mode = 'live'; this.connectedAt = performance.now();
        this._send(PROTO.HELLO, { name: selfName, ver: 1, email: this.email || '' });
        resolve('live');
      };
      this.ws.onmessage = (m) => {
        let msg; try { msg = JSON.parse(m.data); } catch (_) { return; }
        this._handle(msg);
      };
      this.ws.onerror = () => { /* ждём onclose — так надёжнее на некоторых стеках */ };
      this.ws.onclose = () => {
        if (this.mode === 'live') { this.emit('disconnect', {}); }
        else if (this.mode === 'connecting') { clearTimeout(to); this._startLocalSim(selfName); resolve('offline'); }
      };
    });
  }

  _send(type, data) {
    if (this.mode === 'live' && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  _handle(msg) {
    switch (msg.type) {
      case PROTO.WELCOME: this.emit('welcome', msg); break;
      case PROTO.SPAWN:   this.emit('entitySpawn', msg.entity); break;
      case PROTO.DESPAWN: this.emit('entityDespawn', { id: msg.id }); break;
      case PROTO.MOVE:    this.emit('entityMove', msg); break;
      case PROTO.CHAT:    this.emit('chat', msg); break;
      case 'chat_settings': this.emit('chatSettings', msg); break;   // ГМ переключил каналы
      case PROTO.EMOTE:   this.emit('emote', msg); break;
      case 'notice':      this.emit('notice', msg); break;       // служебные сообщения/ГМ-консоль
      case 'announce':    this.emit('announce', msg); break;     // баннер от ГМ
      case 'gm_tp':       this.emit('gmTp', msg); break;         // телепорт по команде ГМ
      case 'gm_xp':       this.emit('gmXp', msg); break;         // начисление опыта ГМ
      case 'kicked':      this.emit('kicked', msg); break;       // выдворен ГМ
      case 'banned':      this.emit('banned', msg); break;       // аккаунт забанен
      // ---- ИНСТАНСЫ (серверные ответы) ----
      case 'inst_list':    this.emit('instList', msg); break;
      case 'inst_enter':   this.emit('instEnter', msg); break;
      case 'inst_progress':this.emit('instProgress', msg); break;
      case 'inst_wave':    this.emit('instWave', msg); break;
      case 'inst_reward':  this.emit('instReward', msg); break;
      case 'inst_end':     this.emit('instEnd', msg); break;
      case 'inst_leave':   this.emit('instLeave', msg); break;
      case 'inst_error':   this.emit('instError', msg); break;
      default: break;
    }
  }

  sendMove(x, z, rot) { this._send(PROTO.MOVE, { x: round(x), z: round(z), r: round(rot) }); }
  sendChat(text, channel) { this._send(PROTO.CHAT, { text, channel: channel || 'global' }); }
  sendEmote(name) { this._send(PROTO.EMOTE, { name }); }
  // ---- Инстансы: запросы к серверной механике ----
  sendInstList() { this._send('inst.list', {}); }
  sendInstCreate(instId, diff, party) { this._send('inst.create', { instId, diff, party }); }
  sendInstKill(runId, boss) { this._send('inst.kill', { runId, boss: !!boss }); }
  sendInstLeave(runId) { this._send('inst.leave', { runId }); }

  // ---------- Локальная симуляция «сервера» ----------
  _startLocalSim(selfName) {
    this.mode = 'offline';
    this.selfName = selfName;
    // Спавним 5–7 ботов-«игроков»
    const count = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const cls = BOT_CLASSES[i % 3];
      const bot = {
        id: 'bot_' + i,
        name: BOT_NAMES[i % BOT_NAMES.length],
        cls, color: BOT_COLORS[cls], level: 2 + Math.floor(Math.random() * 8),
        x: (Math.random() - 0.5) * 46, z: (Math.random() - 0.5) * 46,
        tx: 0, tz: 0, timer: 0, chatTimer: 6 + Math.random() * 18,
      };
      this._pickTarget(bot);
      this._bots.set(bot.id, bot);
      this.emit('entitySpawn', { id: bot.id, kind: 'player', name: bot.name, cls: bot.cls, color: bot.color, level: bot.level, x: bot.x, z: bot.z });
    }
    this._simTimer = setInterval(() => this._tick(), 120);
    this._botTimer = setInterval(() => this._chatter(), 9000);
  }

  _pickTarget(b) {
    b.tx = (Math.random() - 0.5) * 52;
    b.tz = (Math.random() - 0.5) * 52;
    b.timer = 3 + Math.random() * 6;
  }

  _tick() {
    this._t += 0.12;
    for (const b of this._bots.values()) {
      const dx = b.tx - b.x, dz = b.tz - b.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) { this._pickTarget(b); continue; }
      const sp = 2.6;
      b.x += (dx / d) * sp * 0.12;
      b.z += (dz / d) * sp * 0.12;
      const rot = Math.atan2(dx, dz);
      this.emit('entityMove', { id: b.id, x: round(b.x), z: round(b.z), r: round(rot) });
    }
  }

  _chatter() {
    if (this.mode !== 'offline') return;
    const bots = [...this._bots.values()];
    if (!bots.length) return;
    const b = bots[Math.floor(Math.random() * bots.length)];
    const lines = [
      `${b.name}: кто держит западный фланг?`,
      `${b.name}: продам лунный камень, недорого`,
      `${b.name}: Надзиратель респаунится через минуту`,
      `${b.name}: кузница открыта, заходите`,
      `${b.name}: +5 к догадке, ищу группу на курган`,
      `${b.name}: луплю скелетов у кострищ, присоединяйтесь`,
    ];
    this.emit('chat', { author: b.name, text: lines[Math.floor(Math.random() * lines.length)], channel: 'global', color: b.color });
    if (Math.random() < 0.3) this.emit('emote', { id: b.id, name: ['поклон', 'смех', 'крик'][Math.floor(Math.random() * 3)] });
  }

  disconnect() {
    clearInterval(this._simTimer); clearInterval(this._botTimer);
    if (this.ws) { try { this.ws.close(); } catch (_) {} }
    this.mode = 'closed';
  }
}

function round(v) { return Math.round(v * 100) / 100; }
