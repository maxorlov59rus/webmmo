// Мини-DOM: проверяем, что src/main.js выполняется в браузерноподобной среде без ошибок.
import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);

class El {
  constructor(id) { this.id = id; this.style = {}; this.dataset = {}; this._cls = new Set();
    this.children = []; this.listeners = {}; this.textContent = ''; this.value = ''; }
  get classList() { const s = this._cls; return { add:(...a)=>a.forEach(x=>s.add(x)), remove:(...a)=>a.forEach(x=>s.delete(x)), toggle:(x,f)=>f?s.add(x):s.delete(x), contains:x=>s.has(x) }; }
  set innerHTML(v) { this._html = v; // парсим дочерние id
    this.children = [...String(v).matchAll(/id="([^"]+)"/g)].map(m => { const e = new El(m[1]); REG.set(m[1], e); return e; }); }
  get innerHTML() { return this._html || ''; }
  appendChild(c) { this.children.push(c); if (c.id) REG.set(c.id, c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  querySelector(sel) { return new El(null); }
  querySelectorAll() { return []; }
  getContext() { return CTX2D; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  focus() {} blur() {} click() { (this.listeners.click||[]).forEach(f=>f({preventDefault(){},target:this})); }
  closest() { return null; }
  insertAdjacentHTML() {}
  scrollTop = 0; scrollHeight = 0; clientHeight = 0;
}
const CTX2D = new Proxy({}, { get: (t, p) => {
  if (p === 'canvas') return { width: 64, height: 64 };
  if (p === 'measureText') return () => ({ width: 30 });
  if (typeof p === 'string') return (...a) => undefined; }, set: () => true });

const REG = new Map();
ids.forEach(i => REG.set(i, new El(i)));

const document = {
  getElementById: (i) => REG.get(i) || (() => { const e = new El(i); REG.set(i, e); return e; })(),
  createElement: (tag) => { const e = new El(null); e.tag = tag; if (tag === 'canvas') e.width = 64, e.height = 64; return e; },
  body: new El('body'), documentElement: new El('html'), head: new El('head'),
  addEventListener: () => {}, querySelector: () => new El(null), querySelectorAll: () => [],
};
const window_ = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener: () => {}, requestAnimationFrame: () => 1, location: { search: '', href: 'http://localhost:8080/' } };

globalThis.document = document;
globalThis.window = window_;
globalThis.location = window_.location;
globalThis.navigator = { userAgent: 'test' };
globalThis.localStorage = (() => { const m = new Map(); return { getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k), clear:()=>m.clear() }; })();
globalThis.requestAnimationFrame = window_.requestAnimationFrame;
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = { now: () => Date.now() };
globalThis.Image = class { set src(v){ setTimeout(()=>this.onload&&this.onload(),0);} };
globalThis.AudioContext = class { createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0}};} createGain(){return{connect(){},gain:{value:0,exponentialRampToValueAtTime(){}},disconnect(){}};} get currentTime(){return 0;} get destination(){return{};} };

try {
  await import('./src/main.js');
  // даём микрозадачам выполниться
  await new Promise(r => setTimeout(r, 100));
  console.log('MAIN.JS BOOT OK — экран auth инициализирован без исключений');
  // имитируем: регистрация -> выбор мира -> фракция -> создание
  const Auth = await import('./src/ui/auth.js');
  console.log('AUTH MODULE OK');
} catch (e) {
  console.error('BOOT FAIL:', e.stack ? e.stack.split('\n').slice(0,5).join('\n') : e.message);
  process.exit(1);
}
