// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — шаблоны и генератор внешности
//  Случайные персонажи (rollAppearance), готовые шаблоны
//  (TEMPLATES) и детерминированный seed-генератор.
// ============================================================

export const SKIN_TONES = [
  { id: 'fair',   name: 'светлая',        hex: '#e8c39a' },
  { id: 'tan',    name: 'смуглая',        hex: '#c99a6a' },
  { id: 'deep',   name: 'тёмная',         hex: '#8a5f3f' },
  { id: 'ash',    name: 'пепельная',      hex: '#b7ada0' },
  { id: 'dusk',   name: 'сумеречная',     hex: '#9fb0a8' },
  { id: 'ember',  name: 'искристая',      hex: '#d9a274' },
];

export const HAIR_STYLES = [
  { id: 'none',    name: 'лысый/под ноль',  helmet: true },
  { id: 'short',   name: 'короткая стрижка', helmet: false },
  { id: 'long',    name: 'распущенные волосы', helmet: false },
  { id: 'ponytail',name: 'хвост',            helmet: false },
  { id: 'braid',   name: 'косы',             helmet: false },
  { id: 'topknot', name: 'пучок на макушке', helmet: false },
];

export const HAIR_COLORS = [
  { id: 'raven',  name: 'воронов',   hex: '#1c1a20' },
  { id: 'brown',  name: 'каштан',    hex: '#5a3b22' },
  { id: 'red',    name: 'рыжина',    hex: '#a34a20' },
  { id: 'blond',  name: 'лён',       hex: '#c8ab6a' },
  { id: 'gray',   name: 'седина',    hex: '#9aa0a8' },
  { id: 'night',  name: 'ночной',    hex: '#2a2438' },
  { id: 'violet', name: 'фиолетовый',hex: '#6a4fa0' },
  { id: 'white',  name: 'лунный',    hex: '#d8dde4' },
];

export const EYE_COLORS = [
  { id: 'amber',  name: 'янтарные',   hex: '#e8a33d' },
  { id: 'gray',   name: 'серые',      hex: '#8a94a4' },
  { id: 'green',  name: 'зелёные',    hex: '#5a9a6a' },
  { id: 'blue',   name: 'синие',      hex: '#5a8ad0' },
  { id: 'dark',   name: 'карие',      hex: '#3a2a1a' },
  { id: 'moon',   name: 'лунные',     hex: '#b8d0e8' },
];

export const FACIAL_HAIR = [
  { id: 'clean',    name: 'чисто выбрит', beard: false, mustache: false },
  { id: 'stubble',  name: 'трёхдневная щетина', beard: true, mustache: false, thin: true },
  { id: 'mustache', name: 'усы',           beard: false, mustache: true },
  { id: 'beard',    name: 'борода',         beard: true,  mustache: true },
  { id: 'braided',  name: 'заплетённая борода', beard: true, mustache: true, braids: true },
];

export const BODY_TYPES = [
  { id: 'lean',    name: 'стройное',   scale: 0.92 },
  { id: 'lithe',   name: 'гибкое',     scale: 0.97 },
  { id: 'medium',  name: 'среднее',    scale: 1.0 },
  { id: 'burly',   name: 'кряжистое',  scale: 1.06 },
  { id: 'heavy',   name: 'тяжелое',    scale: 1.12 },
];

export const VOICES = ['низкий хрип', 'сорванный бас', 'мягкий баритон', 'резкий тенор', 'шепот сквозь зубы', 'гортанный рык'];

export const SCARS = ['шрам через бровь', 'ожог от искр на щеке', 'выбитый клык', 'носовой шрам', 'покус химеры на предплечье', 'без изъянов'];

// --- Гильдейские цвета плаща/одежды по фракции -------------------------------
export const FACTION_ATTIRE = {
  forge:  { cloth: '#5a3a1c', trim: '#e8a33d', cloak: true,  mask: 'очки механика' },
  umbral: { cloth: '#2c2f3e', trim: '#9b7fd4', cloak: true,  mask: 'полулицевая маска' },
  dusk:   { cloth: '#3a4a34', trim: '#6fcf97', cloak: true,  mask: 'костяной оберег' },
  order:  { cloth: '#6a6458', trim: '#ffd76a', cloak: false, mask: 'латунная маска святоши' },
};

// --- Шаблоны «как в Flash-MMORPG»: готовый образ одним кликом -----------------
export const TEMPLATES = [
  {
    id: 'ember', name: 'Эмбер · кузнец-ветеран', factionHint: 'forge', roleHint: 'warden',
    tagline: 'Обгоревший нагрудник, косынка от искр, руки в мозолях от молота.',
    look: { skin: 'ember', hair: 'braid', hairColor: 'red', eyes: 'amber', faceHair: 'braided', body: 'burly', height: 1.74, voice: 3, scar: 1 },
  },
  {
    id: 'vex', name: 'Векс · ночной странник', factionHint: 'umbral', roleHint: 'scout',
    tagline: 'Прожжённый плащ, лицо скрыто шарфом, глаза видят только тени.',
    look: { skin: 'fair', hair: 'ponytail', hairColor: 'night', eyes: 'gray', faceHair: 'clean', body: 'lithe', height: 1.82, voice: 4, scar: 0 },
  },
  {
    id: 'lyra', name: 'Лира · егерша сумерека', factionHint: 'dusk', roleHint: 'scout',
    tagline: 'Костяные бусы, шкура ручной химеры на плечах, лунные глаза.',
    look: { skin: 'dusk', hair: 'long', hairColor: 'white', eyes: 'moon', faceHair: 'clean', body: 'lean', height: 1.68, voice: 2, scar: 4 },
  },
  {
    id: 'kael', name: 'Каэль · палач веры', factionHint: 'order', roleHint: 'warden',
    tagline: 'Латунная маска с трещиной пополам, латы в следами костра.',
    look: { skin: 'ash', hair: 'short', hairColor: 'gray', eyes: 'blue', faceHair: 'stubble', body: 'heavy', height: 1.88, voice: 0, scar: 3 },
  },
  {
    id: 'mordren', name: 'Мордрен · инженер', factionHint: 'forge', roleHint: 'mage',
    tagline: 'Ремень с инструментами, очки-консервы, вечно пахнет окалиной.',
    look: { skin: 'tan', hair: 'topknot', hairColor: 'brown', eyes: 'green', faceHair: 'mustache', body: 'medium', height: 1.71, voice: 1, scar: 5 },
  },
  {
    id: 'nyx', name: 'Никс · химик', factionHint: 'umbral', roleHint: 'mage',
    tagline: 'Ранцы с реагентами, пробирки бряцают на ходу, фиолетовые пряди.',
    look: { skin: 'fair', hair: 'long', hairColor: 'violet', eyes: 'dark', faceHair: 'clean', body: 'lean', height: 1.65, voice: 5, scar: 2 },
  },
  {
    id: 'ild', name: 'Ильд · надзиратель курганов', factionHint: 'dusk', roleHint: 'warden',
    tagline: 'Шрам от когтя химеры, седые косы, голос как камень о камень.',
    look: { skin: 'deep', hair: 'braid', hairColor: 'gray', eyes: 'amber', faceHair: 'beard', body: 'burly', height: 1.8, voice: 0, scar: 4 },
  },
  {
    id: 'sela', name: 'Села · светочница', factionHint: 'order', roleHint: 'mage',
    tagline: 'Лунные волосы, янтарный взгляд фанатички, сажа под глазами.',
    look: { skin: 'fair', hair: 'ponytail', hairColor: 'white', eyes: 'amber', faceHair: 'clean', body: 'lithe', height: 1.7, voice: 2, scar: 5 },
  },
];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const clampH = (h) => Math.min(195, Math.max(150, Math.round(h)));

// --- Генератор: полностью случайный образ -------------------------------------
export function rollAppearance(rnd = Math.random, factionId = null) {
  const a = {
    gender: rnd() < 0.5 ? 'm' : 'f',
    skin: pick(SKIN_TONES, rnd).id,
    hair: pick(HAIR_STYLES, rnd).id,
    hairColor: pick(HAIR_COLORS, rnd).id,
    eyes: pick(EYE_COLORS, rnd).id,
    faceHair: rnd() < 0.55 ? 'clean' : pick(FACIAL_HAIR.filter(f => f.id !== 'clean'), rnd).id,
    body: pick(BODY_TYPES, rnd).id,
    height: clampH(158 + rnd() * 34),
    voice: Math.floor(rnd() * VOICES.length),
    scar: Math.floor(rnd() * SCARS.length),
    attire: factionId && FACTION_ATTIRE[factionId] ? factionId : null,
  };
  if (a.gender === 'f' && a.faceHair !== 'clean') a.faceHair = 'clean';
  return a;
}

// --- Детерминированный генератор по seed (одинаковый seed = одинаковая морда) --
export function appearanceFromSeed(seed) {
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  return rollAppearance(rnd);
}

export function templateAppearance(tplId) {
  const t = TEMPLATES.find(x => x.id === tplId);
  if (!t) return null;
  return {
    gender: ['ember', 'vex', 'kael', 'mordren', 'ild'].includes(t.id) ? 'm' : 'f',
    skin: t.look.skin, hair: t.look.hair, hairColor: t.look.hairColor,
    eyes: t.look.eyes, faceHair: t.look.faceHair, body: t.look.body,
    height: t.look.height, voice: t.look.voice, scar: t.look.scar, attire: t.factionHint || null,
  };
}

// --- Человекочитаемое описание ------------------------------------------------
export function describeAppearance(a) {
  if (!a) return '';
  const g = a.gender === 'f';
  const skin = (SKIN_TONES.find(s => s.id === a.skin) || SKIN_TONES[0]).name;
  const hair = (HAIR_STYLES.find(h => h.id === a.hair) || HAIR_STYLES[1]).name;
  const hc = (HAIR_COLORS.find(h => h.id === a.hairColor) || HAIR_COLORS[0]).name;
  const eyes = (EYE_COLORS.find(e => e.id === a.eyes) || EYE_COLORS[0]).name;
  const fh = (FACIAL_HAIR.find(f => f.id === a.faceHair) || FACIAL_HAIR[0]).name;
  const body = (BODY_TYPES.find(b => b.id === a.body) || BODY_TYPES[2]).name;
  const parts = [
    `${g ? 'Женщина' : 'Мужчина'}, ${a.height || 172} см`,
    `кожа ${skin}, телосложение ${body}`,
    `волосы: ${hc} (${hair})`,
    `глаза: ${eyes}`,
  ];
  if (a.faceHair !== 'clean') parts.push(`${g ? 'растительность на лице' : 'лицо'}: ${fh}`);
  parts.push(SCARS[a.scar] || SCARS[5]);
  parts.push(`голос: ${VOICES[a.voice] || VOICES[0]}`);
  return parts.join(' · ');
}

// --- Конвертация внешности в параметры 3D-модели ------------------------------
export function appearanceToMeshOpts(a, classColorHex, weaponType = 'sword', factionId = null) {
  const skin = (SKIN_TONES.find(s => s.id === a?.skin) || SKIN_TONES[0]).hex;
  const hc = (HAIR_COLORS.find(h => h.id === a?.hairColor) || HAIR_COLORS[2]).hex;
  const ec = (EYE_COLORS.find(e => e.id === a?.eyes) || EYE_COLORS[0]).hex;
  const attire = FACTION_ATTIRE[factionId] || null;
  const body = (BODY_TYPES.find(b => b.id === a?.body) || BODY_TYPES[2]).scale;
  return {
    skin: parseInt(skin.slice(1), 16),
    hair: parseInt(hc.slice(1), 16),
    eyeColor: parseInt(ec.slice(1), 16),
    cloth: attire ? parseInt(attire.cloth.slice(1), 16) : classColorHex,
    accent: attire ? parseInt(attire.trim.slice(1), 16) : 0x2a2a34,
    metal: 0xaab4c4,
    weaponType,
    cloak: attire ? attire.cloak : true,
    scale: body,
    faceHair: a?.faceHair || 'clean',
    hairStyle: a?.hair || 'short',
    helm: a?.hair === 'none',
  };
}
