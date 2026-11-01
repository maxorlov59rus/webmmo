// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — константы, классы, способности, лут
// ============================================================

export const GAME_TITLE = 'Ночь Военного Ремесла';
export const WORLD_SEED_DEFAULT = 20261102;

// --- Свойства персонажа -----------------------------------------------------
export const STATS = {
  might:   { key: 'might',   name: 'Могущество', short: 'МОГ', desc: 'Урон в ближнем бою и переносимый вес.' },
  ward:    { key: 'ward',    name: 'Защита',     short: 'ЗАЩ', desc: 'Шанс блока и снижение получаемого урона.' },
  arcane:  { key: 'arcane',  name: 'Магия',      short: 'МАГ', desc: 'Сила заклинаний и запас маны.' },
  agility: { key: 'agility', name: 'Ловкость',   short: 'ЛОВ', desc: 'Скорость передвижения и критический шанс.' },
  wit:     { key: 'wit',     name: 'Догадка',    short: 'ДОГ', desc: 'Дальность обзора, добыча опыта и находка лута.' },
};
export const STAT_KEYS = Object.keys(STATS);

// --- Классы -----------------------------------------------------------------
export const CLASSES = {
  warden: {
    id: 'warden', name: 'Ратник Заставы', color: '#7fa8d9',
    tag: 'Ближний бой · крепость',
    base: { hp: 130, mp: 40, might: 9, ward: 8, arcane: 2, agility: 5, wit: 4 },
    growth: { hp: 16, mp: 4, might: 2.2, ward: 2.0, arcane: 0.4, agility: 1.0, wit: 0.6 },
    startKit: ['iron_sword', 'leather_vest', 'health_potion'],
    desc: 'Крепкая стена заставы. Держит удар, рубит строй.',
  },
  mage: {
    id: 'mage', name: 'Чародей Ночи', color: '#b48ce8',
    tag: 'Заклинания · дальний бой',
    base: { hp: 85, mp: 110, might: 3, ward: 3, arcane: 10, agility: 5, wit: 6 },
    growth: { hp: 9, mp: 15, might: 0.6, ward: 0.7, arcane: 2.4, agility: 1.0, wit: 1.0 },
    startKit: ['oak_staff', 'mages_robe', 'mana_potion'],
    desc: 'Вызывает искры ночного неба. Хрупок, но смертоносен издалека.',
  },
  scout: {
    id: 'scout', name: 'Разведчик-копейщик', color: '#8fd18f',
    tag: 'Скорость · точность',
    base: { hp: 105, mp: 60, might: 6, ward: 5, arcane: 4, agility: 9, wit: 6 },
    growth: { hp: 12, mp: 8, might: 1.4, ward: 1.2, arcane: 0.9, agility: 2.2, wit: 1.0 },
    startKit: ['hunters_spear', 'rangers_cloak', 'health_potion'],
    desc: 'Быстрее ветра над полем. Копьё его длиннее, чем реакция врага.',
  },
};

// --- Предметы ---------------------------------------------------------------
// slot: weapon | body | trinket | none (расходники)
export const ITEMS = {
  // Оружие
  iron_sword:      { id: 'iron_sword', name: 'Железный меч', slot: 'weapon', rarity: 1, dmg: [6, 11], speed: 1.0, mods: { might: 1 } },
  oak_staff:       { id: 'oak_staff', name: 'Дубовый посох', slot: 'weapon', rarity: 1, dmg: [4, 8], speed: 1.1, mods: { arcane: 2, mp: 15 } },
  hunters_spear:   { id: 'hunters_spear', name: 'Копьё охотника', slot: 'weapon', rarity: 1, dmg: [5, 10], reach: 1.6, speed: 0.9, mods: { agility: 1 } },
  nightfall_blade: { id: 'nightfall_blade', name: 'Клинок Malamur', slot: 'weapon', rarity: 3, dmg: [12, 20], speed: 1.05, mods: { might: 3, crit: 6 }, lore: 'Куют его под луной из руды, что не видит солнца.' },
  runesplitter:    { id: 'runesplitter', name: 'Руноруб', slot: 'weapon', rarity: 4, dmg: [16, 26], speed: 0.85, mods: { might: 5, ward: 2 }, lore: 'Секира павшего кузнеца-берсерка. Руны на лезвии гаснут, когда рядом враг.' },
  moonspike:       { id: 'moonspike', name: 'Лунная заноза', slot: 'weapon', rarity: 4, dmg: [10, 17], reach: 1.8, speed: 1.2, mods: { agility: 4, arcane: 3 }, lore: 'Копьё, выструганное из луча луны колдовским резцом.' },
  stormrod:        { id: 'stormrod', name: 'Грозовой жезл', slot: 'weapon', rarity: 4, dmg: [9, 15], speed: 1.0, mods: { arcane: 6, mp: 40 }, lore: 'Внутри жезла заперта гроза. Иногда она просится наружу.' },

  // Броня
  leather_vest:    { id: 'leather_vest', name: 'Кожаный жилет', slot: 'body', rarity: 1, armor: [1, 3], mods: { ward: 2 } },
  mages_robe:      { id: 'mages_robe', name: 'Мантия чародея', slot: 'body', rarity: 1, armor: [0, 2], mods: { arcane: 2, mp: 20 } },
  rangers_cloak:   { id: 'rangers_cloak', name: 'Плащ следопыта', slot: 'body', rarity: 1, armor: [1, 2], mods: { agility: 2 } },
  mail_hauberk:    { id: 'mail_hauberk', name: 'Кольчуга', slot: 'body', rarity: 2, armor: [3, 6], mods: { ward: 4, hp: 20 } },
  warden_plate:    { id: 'warden_plate', name: 'Латы Заставы', slot: 'body', rarity: 4, armor: [6, 11], mods: { ward: 8, hp: 45, agility: -2 }, lore: 'Наследие тех, кто держал Ночную Заставу, когда её ещё было кому держать.' },
  duskweave:       { id: 'duskweave', name: 'Сумеречная ткань', slot: 'body', rarity: 3, armor: [2, 5], mods: { arcane: 4, mp: 35, agility: 2 } },

  // Амуниция
  ember_ring:      { id: 'ember_ring', name: 'Кольцо угольков', slot: 'trinket', rarity: 2, mods: { arcane: 3, mp: 25 } },
  wolf_tooth:      { id: 'wolf_tooth', name: 'Зуб вожака', slot: 'trinket', rarity: 2, mods: { might: 3, crit: 5 } },
  sentinel_charm:  { id: 'sentinel_charm', name: 'Оберег часовой', slot: 'trinket', rarity: 3, mods: { ward: 5, hp: 30 } },
  moonsignet:      { id: 'moonsignet', name: 'Перстень Ночной Заставы', slot: 'trinket', rarity: 4, mods: { might: 2, ward: 2, arcane: 2, agility: 2, wit: 2 }, lore: 'Печать командира заставы. Все пять свойств — как пять дозоров ночи.' },

  // Расходники
  health_potion:   { id: 'health_potion', name: 'Зелье лечения', slot: 'none', stack: true, use: { type: 'heal', value: 60 } },
  mana_potion:     { id: 'mana_potion', name: 'Зелье маны', slot: 'none', stack: true, use: { type: 'mana', value: 50 } },
  iron_ore:        { id: 'iron_ore', name: 'Железная руда', slot: 'none', stack: true, mat: true },
  moonstone:       { id: 'moonstone', name: 'Лунный камень', slot: 'none', stack: true, mat: true },
  scroll_nightforge:{ id: 'scroll_nightforge', name: 'Свиток Ночного Кузнечного Дела', slot: 'none', stack: true, quest: true,
                     lore: 'Три строки, три удара молота, одна ночь. Так куют оружие, которое не боится тьмы.' },
};
export const RARITY_NAMES = ['Обычный', 'Необычный', 'Редкий', 'Эпический', 'Легендарный'];
export const RARITY_COLORS = ['#c8c8c8', '#6fd36f', '#5aa9ff', '#c07ff0', '#ffb64a'];

// --- Способности ------------------------------------------------------------
// kind: active | passive ; target: self | enemy | point
export const ABILITIES = {
  cleave: {
    id: 'cleave', name: 'Рассекающий удар', class: 'warden', level: 1, kind: 'active',
    cost: { mp: 8 }, cd: 3.5, target: 'self', radius: 3.4,
    desc: 'Мощный круговой взмах: урон всем врагам вокруг.',
    power: (s) => 1.4 * s.dmgBase + s.might * 0.9,
  },
  bulwark: {
    id: 'bulwark', name: 'Бастион', class: 'warden', level: 3, kind: 'active',
    cost: { mp: 15 }, cd: 14, target: 'self', duration: 6,
    desc: 'Несокрушимая стойка: поглощает 50% входящего урона на 6 сек.',
    effect: { type: 'shield', ratio: 0.5 },
  },
  warcry: {
    id: 'riposte_stub', name: '', class: 'warden', level: 0, kind: 'passive',
    cost: {}, cd: 0, desc: '',
  },
  riposte: {
    id: 'riposte', name: 'Ответный клинок', class: 'warden', level: 5, kind: 'passive',
    cost: {}, cd: 0, target: 'self',
    desc: 'Пассивно: +8% шанса блока, блок возвращает урон атакующему.',
    effect: { type: 'blockBonus', value: 8 },
  },
  spark: {
    id: 'spark', name: 'Искра ночи', class: 'mage', level: 1, kind: 'active',
    cost: { mp: 6 }, cd: 0.8, target: 'enemy', range: 16, projSpeed: 26,
    desc: 'Быстрый снаряд тёмной искры.',
    power: (s) => 1.0 * s.magBase + s.arcane * 1.1,
  },
  frostlance: {
    id: 'frostlance', name: 'Моросящее копьё', class: 'mage', level: 3, kind: 'active',
    cost: { mp: 18 }, cd: 6, target: 'enemy', range: 18, projSpeed: 22,
    desc: 'Пробивает цель и замедляет её на 4 сек.',
    power: (s) => 1.7 * s.magBase + s.arcane * 1.5,
    effect: { type: 'slow', ratio: 0.5, duration: 4 },
  },
  nightfire: {
    id: 'nightfire', name: 'Ночной жар', class: 'mage', level: 6, kind: 'active',
    cost: { mp: 32 }, cd: 12, target: 'point', range: 15, radius: 3.6, duration: 5,
    desc: 'Зажигает землю: периодический урон по площади.',
    power: (s) => 0.6 * s.magBase + s.arcane * 0.6,
  },
  precise: {
    id: 'precise', name: 'Меткий глаз', class: 'scout', level: 1, kind: 'active',
    cost: { mp: 10 }, cd: 5, target: 'enemy', range: 18, projSpeed: 34,
    desc: 'Прицельный выпад копьём с повышенным критическим шансом.',
    power: (s) => 1.5 * s.dmgBase + s.agility * 0.8,
    effect: { type: 'critBoost', value: 30 },
  },
  volley: {
    id: 'volley', name: 'Веер ударов', class: 'scout', level: 4, kind: 'active',
    cost: { mp: 16 }, cd: 8, target: 'self', radius: 4.2,
    desc: 'Три быстрых удара веером по всем вокруг.',
    power: (s) => 1.1 * s.dmgBase + s.agility * 0.7,
  },
  shadowstep: {
    id: 'shadowstep', name: 'Теневой шаг', class: 'scout', level: 6, kind: 'active',
    cost: { mp: 20 }, cd: 10, target: 'point', range: 11,
    desc: 'Рывок сквозь тень к указанной точке, оглушение задетых врагов.',
    effect: { type: 'stun', duration: 1.2 },
  },
  alert: {
    id: 'alert', name: 'Ночная хватка', class: 'scout', level: 2, kind: 'passive',
    cost: {}, cd: 0, target: 'self',
    desc: 'Пассивно: +12% скорости и +5 к дальности обзора.',
    effect: { type: 'speedBonus', value: 12 },
  },
  insight: {
    id: 'insight', name: 'Догадливая натура', class: 'all', level: 1, kind: 'passive',
    cost: {}, cd: 0, target: 'self',
    desc: 'Пассивно: опыт от побед растёт с Догадкой (+2% за очко).',
    effect: { type: 'xpBonus' },
  },
};

// --- Крафт (Ночное Кузнечное Дело) ------------------------------------------
export const RECIPES = [
  { out: 'mail_hauberk', mats: { iron_ore: 3 }, time: 2.0, reqLevel: 1 },
  { out: 'ember_ring',   mats: { iron_ore: 2, moonstone: 1 }, time: 2.0, reqLevel: 1 },
  { out: 'nightfall_blade', mats: { iron_ore: 4, moonstone: 2 }, time: 3.0, reqLevel: 3 },
  { out: 'duskweave',    mats: { moonstone: 3, iron_ore: 1 }, time: 3.0, reqLevel: 3 },
  { out: 'sentinel_charm', mats: { iron_ore: 3, moonstone: 2 }, time: 3.0, reqLevel: 4 },
  { out: 'health_potion', mats: { moonstone: 1 }, time: 1.0, reqLevel: 1 },
  { out: 'mana_potion',   mats: { iron_ore: 1 }, time: 1.0, reqLevel: 1 },
];

// --- Квесты ------------------------------------------------------------------
export const QUESTS = [
  {
    id: 'q_forge', name: 'Ночь Военного Ремесла', giver: 'Дормир Молот', color: '#ffb64a',
    hint: 'Найди свиток Ночного Кузнечного Дела и принеси его Дормиру.',
    steps: [
      { text: 'Отыщи Свиток Ночного Кузнечного Дела.', type: 'collect', item: 'scroll_nightforge', count: 1 },
      { text: 'Вернись к Дормиру Молоту.', type: 'talk', npc: 'dormir' },
    ],
    reward: { xp: 120, gold: 40, items: ['moonstone', 'moonstone'] },
  },
  {
    id: 'q_wolves', name: 'Стая у стены', giver: 'Дормир Молот', color: '#7fa8d9',
    hint: 'Тенивые волки рыщут у палисада. Убей шесть.',
    steps: [
      { text: 'Перебей тенивых волков (6).', type: 'kill', mob: 'wolf', count: 6 },
    ],
    reward: { xp: 90, gold: 25, items: ['health_potion', 'health_potion'] },
  },
  {
    id: 'q_bones', name: 'Кости у костра', giver: 'Ведьма Илва', color: '#b48ce8',
    hint: 'Неупокоенные поднимаются у старых кострищ. Очисти место.',
    steps: [
      { text: 'Уничтожь неупокоенных (5).', type: 'kill', mob: 'skeleton', count: 5 },
      { text: 'Доложи Ведьме Илве.', type: 'talk', npc: 'ilva' },
    ],
    reward: { xp: 140, gold: 50, items: ['mana_potion', 'ember_ring'] },
  },
];

// --- Мобы --------------------------------------------------------------------
export const MOBS = {
  wolf: {
    id: 'wolf', name: 'Тенивый волк', level: 2, hp: 45, dmg: [4, 8], speed: 3.6,
    xp: 18, gold: [2, 6], aggro: 11, attackRange: 1.6, respawn: 14, shape: 'wolf',
    loot: [['iron_ore', 0.35], ['health_potion', 0.12]],
  },
  skeleton: {
    id: 'skeleton', name: 'Неупокоенный воин', level: 4, hp: 80, dmg: [7, 12], speed: 2.4,
    xp: 34, gold: [5, 12], aggro: 12, attackRange: 2.0, respawn: 18, shape: 'skeleton',
    loot: [['iron_ore', 0.4], ['moonstone', 0.15], ['mail_hauberk', 0.06]],
  },
  shade: {
    id: 'shade', name: 'Ночная Тень', level: 6, hp: 110, dmg: [10, 16], speed: 3.0,
    xp: 55, gold: [8, 18], aggro: 13, attackRange: 2.2, respawn: 22, shape: 'shade',
    loot: [['moonstone', 0.3], ['duskweave', 0.07], ['nightfall_blade', 0.04]],
  },
  overseer: {
    id: 'overseer', name: 'Надзиратель Ночи', level: 9, hp: 320, dmg: [14, 22], speed: 2.2,
    xp: 180, gold: [30, 60], aggro: 14, attackRange: 2.6, respawn: 60, shape: 'overseer', boss: true,
    loot: [['runesplitter', 0.18], ['moonspike', 0.18], ['stormrod', 0.18], ['moonsignet', 0.12], ['scroll_nightforge', 0.5]],
  },
};

// --- NPC ---------------------------------------------------------------------
export const NPCS = {
  dormir: { id: 'dormir', name: 'Дормир Молот', role: 'Кузнец · крафт и квесты', color: '#d98c4a', x: 6, z: -4, quests: ['q_forge', 'q_wolves'] },
  ilva:   { id: 'ilva', name: 'Ведьма Илва', role: 'Травница · зелья', color: '#9a6fd0', x: -8, z: 5, quests: ['q_bones'] },
  serj:   { id: 'serj', name: 'Сержант Вьюг', role: 'Застава · обучение', color: '#6fa8d0', x: -2, z: 9, tutorial: true },
};

// --- Диалоги -----------------------------------------------------------------
export const DIALOGS = {
  serj: [
    'Застава на ножках, новичок. WASD — ноги, ЛКМ — клинок, ПКМ по врагу — способность.',
    'Ночью тут ремесло военное цветёт. Кузницу найдёшь у Дормира, он не кусается. Обычно.',
  ],
  dormir: [
    'Пока горит горн — мы куём. Пока не горит — ищем, чем разжечь.',
    'Свиток Ночного Кузнечного Дела у Надзирателя Ночи. Без него я тебе только гвоздь выкую.',
  ],
  ilva: [
    'Траву я собираю при луне, кости — при звезде. Не путай.',
    'Неупокоенные у кострищ? Вот и славно, значит луна сегодня злая.',
  ],
};

// --- Помехи связи (MMO-флейвор) ---------------------------------------------
export const CHATTER = [
  '[Z_Strannik] торгует: 2x Железный меч, цена договорная',
  '[Vedma_Kira] ищет группу: зачистить западный курган',
  '[Grom] вступил в Заставу Ночного Кузнечного Дела',
  '[Luna_V] убила: Надзиратель Ночи (ранг S)',
  '[Ratobor] продаёт свиток усиления, недорого',
  '[Zima] спрашивает: где фармить лунный камень?',
  '[Iskra] присоединилась к каналу «Костёр»',
  '[Volk] покинул игру: «кузница снова сломана»',
];

export const EMOTES = ['/поклон', '/крик', '/смех', '/драться', '/танец', '/присесть'];
