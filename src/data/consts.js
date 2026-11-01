// ============================================================
//  НОЧЬ ВОЕННОГО РЕМЕСЛА — константы, классы, способности, лут
// ============================================================

export const GAME_TITLE = 'Ночь Военного Ремесла';
export const WORLD_SEED_DEFAULT = 20261102;

// ============================================================
//  ФРАКЦИИ ЭФИРИИ — лор «Великого Затмения» (Долгая Ночь, 300 лет)
// ============================================================
export const FACTIONS = {
  forge: {
    id: 'forge', name: 'Гильдия Золотого Горна', short: 'Горн', color: '#e8a33d', icon: '⚙',
    motto: 'Порядок через индустрию. Тьму нужно сжечь.',
    desc: 'Бывшие имперские инженеры и кузнецы. Их цитадель — вечно дымящий завод на люмините. Презирают магию, доверяют пару, стали и пороху; мечтают создать искусственное солнце.',
    capital: 'Цитадель Паровых Молотов', style: 'клокпанк · тяжёлая броня · револьверы',
    enemies: ['umbral'], allies: [],
  },
  umbral: {
    id: 'umbral', name: 'Теневой Синдикат', short: 'Синдикат', color: '#9b7fd4', icon: '🜄',
    motto: 'Свобода через торговлю. Тьма — это рынок.',
    desc: 'Контрабандисты, алхимики и наёмники в руинах летающего города. Не борются с ночью — монетизируют её: информация, реагенты из глубин, контрабандный свет.',
    capital: 'Руины Аэрии', style: 'нуар · плащи · маски · скрытые клинки',
    enemies: [], allies: [],
  },
  dusk: {
    id: 'dusk', name: 'Дети Сумерек', short: 'Сумерки', color: '#6fcf97', icon: '☾',
    motto: 'Гармония через адаптацию. Тьма — это новый дом.',
    desc: 'Мистики и друиды сумеречных лесов. Приручают химер, носят их шкуры, правят самой тьмой. Солнце мертво — возвращать его кощунственно.',
    capital: 'Роща Шепчущих Кострей', style: 'биопанк · костяные луки · тотемы',
    enemies: ['forge'], allies: [],
  },
  order: {
    id: 'order', name: 'Орден Неугасимого Света', short: 'Орден', color: '#ffd76a', icon: '✥',
    motto: 'Очищение через веру. Тьма — это грех.',
    desc: 'Фанатичный военный орден. Затмение — кара, химеры — проклятые души. Их свет ярче всех — и сводит с ума тех, кто на него смотрит.',
    capital: 'Храм Вечного Полудня', style: 'готика · латунные маски · огнеметы святой воды',
    enemies: ['umbral', 'dusk'], allies: [],
  },
};
export const FACTION_KEYS = Object.keys(FACTIONS);

// --- Ролевая специализация (стиль боя) ---
export const ROLES = {
  warden: { id: 'warden', name: 'Ратник', tag: 'Ближний бой · крепость' },
  mage:   { id: 'mage',   name: 'Чародей', tag: 'Заклинания · дальний бой' },
  scout:  { id: 'scout',  name: 'Разведчик', tag: 'Скорость · точность' },
};

// ============================================================
//  12 АРХЕТИПОВ — привязаны к фракции + роли.
//  role: класс-скелет (статы/предметы); faction: идеология и бонус.
//  arch: набор способностей (см. ABILITIES), bonus — пассивка архетипа.
// ============================================================
export const ARCHETYPES = {
  // --- Золотой Горн: танки и ДД ближнего боя ---
  artillerist: {
    id: 'artillerist', name: 'Инженер-Разрушитель', faction: 'forge', role: 'warden', level: 1,
    tag: 'Турели · капканы · молот-ключ',
    desc: 'Специалист по осадному вооружению: ставит турели с раскалённой шрапнелью и капканы с горючим гелем. Владеет гаечным ключом-молотом.',
    arch: ['cleave', 'bulwark', 'riposte', 'spark', 'turret'],
    bonus: { type: 'turretBoost', value: 15, text: '+15% урона турелей и механизмов.' },
  },
  steelbreaker: {
    id: 'steelbreaker', name: 'Сталебой', faction: 'forge', role: 'warden', level: 1,
    tag: 'Экзоскелет · кинетический поглотитель',
    desc: 'Танк в экзоскелете. Вместо блока — «Кинетический поглотитель»: принимает удар на грудь и бьёт ответным тараном.',
    arch: ['cleave', 'bulwark', 'charge', 'riposte'],
    bonus: { type: 'absorbCounter', value: 20, text: 'Поглощённый урон заряжает таран: +20% к следующему удару за каждые 10 поглощённых.' },
  },
  blazewright: {
    id: 'blazewright', name: 'Огненный Клинок', faction: 'forge', role: 'warden', level: 1,
    tag: 'Берсерк · катализаторы крови · зоны огня',
    desc: 'Берсерк на катализаторах. Его удары поджигают землю; чем дольше в бою — тем быстрее, но броня тает.',
    arch: ['cleave', 'nightfire', 'warcry', 'emberstorm'],
    bonus: { type: 'furyRamp', text: '+4% скорости атаки за каждую секунду боя (до +40%), −1% брони за секунду (до −10%).' },
  },
  // --- Теневой Синдикат: скрытность и контроль ---
  phosphor: {
    id: 'phosphor', name: 'Фосфорный Убийца', faction: 'umbral', role: 'scout', level: 1,
    tag: 'Световые гранаты · отравленный стилет',
    desc: 'Свет как оружие внезапности: ослепляющие гранаты выдают позицию, зато удар стилетом в шею заканчивает бой.',
    arch: ['shadowstep', 'poisonshot', 'rapidvolley', 'blindflash'],
    bonus: { type: 'backstab', value: 35, text: '+35% урона из невидимости / со спины.' },
  },
  chemist: {
    id: 'chemist', name: 'Химик-Аэрозольщик', faction: 'umbral', role: 'mage', level: 1,
    tag: 'Газы контроля · усиление союзников',
    desc: 'Поддержка-контроль: усыпляющий туман, коррозийный (снимает броню) или галлюциногенный смог — химеры начинают рвать друг друга.',
    arch: ['frostlance', 'toxiccloud', 'manaarrow', 'corrosivefog'],
    bonus: { type: 'gasDuration', value: 30, text: 'Все газы и туманы живут на 30% дольше.' },
  },
  cablerunner: {
    id: 'cablerunner', name: 'Канатный Прыгун', faction: 'umbral', role: 'scout', level: 1,
    tag: 'Гарпун · мобильность · работа с высоты',
    desc: 'Тросомент по вертикальным шахтам цитаделей. Бьёт с воздуха, притягивает врагов гарпуном или толкает в пропасть.',
    arch: ['hookpull', 'shadowstep', 'rapidvolley', 'poisonshot'],
    bonus: { type: 'airborne', value: 15, text: '+15% урона после прыжка/гарпуна первые 3 сек; скорость +10% вне боя.' },
  },
  // --- Дети Сумерек: призыв и магия ---
  beastmaster: {
    id: 'beastmaster', name: 'Зверолов', faction: 'dusk', role: 'scout', level: 1,
    tag: 'Прирученные химеры · парные серпы',
    desc: 'Зовёт из теней прирученных химер — Слепого Гончего, идущего на слух. Сам дерется серпами, усиливая удары феромонами.',
    arch: ['companioncall', 'poisonshot', 'rapidvolley', 'feralhowl'],
    bonus: { type: 'petScaling', value: 20, text: 'Спутник получает +20% здоровья и урона.' },
  },
  gravweaver: {
    id: 'gravweaver', name: 'Ткач Гравитации', faction: 'dusk', role: 'mage', level: 1,
    tag: 'Нулевая гравитация · сверхплотные зоны',
    desc: 'Управляет плотностью тьмы: подбрасывает врагов зоной нулевой гравитации или обездвиживает сверхплотной.',
    arch: ['frostlance', 'zerogzone', 'spark', 'crushwell'],
    bonus: { type: 'slowAura', value: 10, text: 'Враги в радиусе 6 медленнее на 10%; длительность зон гравитации +25%.' },
  },
  defiler: {
    id: 'defiler', name: 'Осквернитель', faction: 'dusk', role: 'mage', level: 1,
    tag: 'Лекарь через порчу · DoT-взрывы',
    desc: 'Лечит союзников силой, вытянутой из трупов и земли. Накладывает порчу, взрывающуюся при снятии.',
    arch: ['leechgrasp', 'healdark', 'toxiccloud', 'rotburst'],
    bonus: { type: 'corpseFeed', value: 8, text: 'Убийство восстанавливает 8 HP и 4 MP (вытягивание из плоти).' },
  },
  // --- Орден Неугасимого Света: бурст и AoE ---
  purifier: {
    id: 'purifier', name: 'Инквизитор-Пурификатор', faction: 'order', role: 'mage', level: 1,
    tag: 'Солнечный реактор · луч сквозь врагов',
    desc: 'Несёт на спине солнечный реактор. Концентрированный луч проходит сквозь строй врагов, выжигая всё на линии.',
    arch: ['solarbeam', 'spark', 'frostlance', 'lightward'],
    bonus: { type: 'pierceBeam', value: 2, text: 'Луч пробивает на 2 цели больше; свет от вас отпугивает химер (агро −20%).' },
  },
  exorcist: {
    id: 'exorcist', name: 'Экзорцист', faction: 'order', role: 'warden', level: 1,
    tag: 'Цеп · Метка Очищения · взрывы',
    desc: 'Боец ближнего боя с цепом. Каждое попадание вешает Метку Очищения; на пяти метках цель взрывается священным пламенем.',
    arch: ['cleansestrike', 'cleave', 'bulwark', 'conviction'],
    bonus: { type: 'markExplode', value: 5, text: 'Взрыв меток срабатывает на 5-й метке: AoE-урон священным пламенем.' },
  },
  ashherald: {
    id: 'ashherald', name: 'Вестник Пепла', faction: 'order', role: 'mage', level: 1,
    tag: 'Метеоритный пепел · Святая зола',
    desc: 'Не использует чистый свет (слепит союзников) — использует его тлен. Пепел выжигает ману врагов; «Святая зола» жжёт химер и ускоряет каст людей.',
    arch: ['ashfall', 'spark', 'manaarrow', 'cinderveil'],
    bonus: { type: 'holyAsh', value: 15, text: 'Зоны Святой золы дают вам и союзникам +15% скорости каста.' },
  },
};
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);
export function archetypesForFaction(fid) { return ARCHETYPE_KEYS.filter(k => ARCHETYPES[k].faction === fid); }
export function rolesForFaction(fid) {
  const set = new Set(archetypesForFaction(fid).map(k => ARCHETYPES[k].role));
  return [...set];
}

// --- Миры (серверы) ---
export const WORLDS = [
  { id: 'nwm-1', name: 'Первый Костёр', pop: 'высокая', ping: 24, desc: 'Старейшая заставу Эфирии. Полный лут-таблица, PvP-флаг включён после 15 уровня.', seed: 20261102 },
  { id: 'nwm-2', name: 'Люминитовый Разлом', pop: 'средняя', ping: 38, desc: 'Шахты Гильдии: вдвое больше руды и светокамня, но химеры агрессивнее.', seed: 770211 },
  { id: 'nwm-3', name: 'Пепел Аэрии', pop: 'низкая', ping: 51, desc: 'Руины летающего города Синдиката. Подземелья, контрабанда, тёмные рынки.', seed: 411007 },
  { id: 'nwm-4', name: 'Сумеречная Роща', pop: 'высокая', ping: 31, desc: 'Леса Детей Сумерек: ручные химеры, редкие травы, ночные туманы.', seed: 902113 },
];

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
    id: 'warcry', name: 'Боевой клич', class: 'warden', level: 4, kind: 'active',
    cost: { mp: 12 }, cd: 18, target: 'self', radius: 9, duration: 8,
    desc: 'Рёв сквозь ночь: +20% урона вам и союзникам на 8 сек; враги рядом замедлены.',
    effect: { type: 'buffPower', ratio: 0.2, slowRatio: 0.65, slowDuration: 3 },
  },
  charge: {
    id: 'charge', name: 'Кинетический таран', class: 'warden', level: 4, kind: 'active',
    cost: { mp: 14 }, cd: 9, target: 'point', range: 10,
    desc: 'Разгон экзоскелета: рывок вперёд, оглушение задетых и урон от массы стали.',
    power: (s) => 1.1 * s.dmgBase + s.ward * 0.8,
    effect: { type: 'stun', duration: 1.0 },
  },
  // --- Золотой Горн -----------------------------------------------------
  turret: {
    id: 'turret', name: 'Шрапнельная турель', class: 'artillerist', level: 4, kind: 'active',
    cost: { mp: 25 }, cd: 16, target: 'point', range: 12, radius: 6, duration: 10, tickDamage: true,
    desc: 'Ставит паровую турель: стреляет раскалённой шрапнелью по ближайшим врагам 10 сек.',
    power: (s) => 0.5 * s.dmgBase + s.might * 0.5,
  },
  emberstorm: {
    id: 'emberstorm', name: 'Шквал углей', class: 'blazewright', level: 6, kind: 'active',
    cost: { mp: 22 }, cd: 12, target: 'self', radius: 5, duration: 4,
    desc: 'Взрыв катализаторов: волны углей жгут всё вокруг и поджигают землю.',
    power: (s) => 0.9 * s.dmgBase + s.might * 0.7,
  },
  // --- Теневой Синдикат --------------------------------------------------
  poisonshot: {
    id: 'poisonshot', name: 'Отравленный выпад', class: 'scout', level: 2, kind: 'active',
    cost: { mp: 8 }, cd: 4, target: 'enemy', range: 17, projSpeed: 30,
    desc: 'Выпад стилетом/копьём с ядом глубин: урон и отрава на 6 сек.',
    power: (s) => 1.1 * s.dmgBase + s.agility * 0.6,
    effect: { type: 'dot', dps: () => 4, duration: 6 },
  },
  rapidvolley: {
    id: 'rapidvolley', name: 'Веер-комбо', class: 'scout', level: 4, kind: 'active',
    cost: { mp: 16 }, cd: 8, target: 'self', radius: 4.2,
    desc: 'Серия молниеносных ударов веером по всем вокруг.',
    power: (s) => 1.2 * s.dmgBase + s.agility * 0.7,
  },
  blindflash: {
    id: 'blindflash', name: 'Фосфорная вспышка', class: 'phosphor', level: 5, kind: 'active',
    cost: { mp: 20 }, cd: 14, target: 'self', radius: 7,
    desc: 'Световая граната: ослепляет врагов (промахиваются 4 сек), но выдаёт вашу позицию.',
    power: (s) => 0.6 * s.dmgBase,
    effect: { type: 'blind', duration: 4 },
  },
  corrosivefog: {
    id: 'corrosivefog', name: 'Коррозийный туман', class: 'chemist', level: 4, kind: 'active',
    cost: { mp: 24 }, cd: 13, target: 'point', range: 14, radius: 4.5, duration: 8,
    desc: 'Едкий смог: снижает броню врагов в зоне на 40% и точечно разъедает их.',
    power: (s) => 0.4 * s.magBase + s.arcane * 0.4,
    effect: { type: 'armorShred', ratio: 0.4, duration: 8 },
  },
  manaarrow: {
    id: 'manaarrow', name: 'Игольная мана-стрела', class: 'mage', level: 2, kind: 'active',
    cost: { mp: 10 }, cd: 2.5, target: 'enemy', range: 19, projSpeed: 32,
    desc: 'Тонкий луч, выжигающий ману цели (−15 MP) и наносящий урон.',
    power: (s) => 0.9 * s.magBase + s.arcane * 0.8,
    effect: { type: 'drainMana', value: 15 },
  },
  hookpull: {
    id: 'hookpull', name: 'Гарпун-трос', class: 'cablerunner', level: 3, kind: 'active',
    cost: { mp: 15 }, cd: 8, target: 'enemy', range: 15,
    desc: 'Ловит цель гарпуном и притягивает её к вам, оглушая на 0.8 сек.',
    power: (s) => 0.8 * s.dmgBase + s.agility * 0.5,
    effect: { type: 'pull', stun: 0.8 },
  },
  // --- Дети Сумерек ------------------------------------------------------
  companioncall: {
    id: 'companioncall', name: 'Зов Слепого Гончего', class: 'beastmaster', level: 3, kind: 'active',
    cost: { mp: 25 }, cd: 20, target: 'self', duration: 30,
    desc: 'Из тени выходит прирученная химера — бьёт тех, кто трогает хозяина. Живёт 30 сек.',
    effect: { type: 'sumpet', hpRatio: 0.6, dmgRatio: 0.55, duration: 30 },
  },
  feralhowl: {
    id: 'feralhowl', name: 'Феромональный вой', class: 'beastmaster', level: 6, kind: 'active',
    cost: { mp: 18 }, cd: 15, target: 'self', radius: 8, duration: 8,
    desc: 'Вой усиливает инстинкты: +15% скорости атаки вам и спутнику; враги в страхе замедляются.',
    effect: { type: 'buffSpeed', ratio: 0.15, slowRatio: 0.7, slowDuration: 3 },
  },
  zerogzone: {
    id: 'zerogzone', name: 'Нулевая гравитация', class: 'gravweaver', level: 5, kind: 'active',
    cost: { mp: 28 }, cd: 14, target: 'point', range: 15, radius: 4, duration: 4,
    desc: 'Зона невесомости подбрасывает врагов и снимает с них скорость; при выходе — урон.',
    power: (s) => 0.8 * s.magBase + s.arcane * 0.8,
    effect: { type: 'launch' },
  },
  crushwell: {
    id: 'crushwell', name: 'Сверхплотная тьма', class: 'gravweaver', level: 7, kind: 'active',
    cost: { mp: 30 }, cd: 16, target: 'point', range: 14, radius: 3.8, duration: 6,
    desc: 'Тьма густеет до состояния смолы: враги в зоне почти обездвижены и получают урон.',
    power: (s) => 0.5 * s.magBase + s.arcane * 0.5,
    effect: { type: 'root', ratio: 0.15 },
  },
  leechgrasp: {
    id: 'leechgrasp', name: 'Хват тлена', class: 'defiler', level: 2, kind: 'active',
    cost: { mp: 12 }, cd: 5, target: 'enemy', range: 16, projSpeed: 20,
    desc: 'Щупальца порчи тянут жизнь из цели: урон и 60% вам как лечение.',
    power: (s) => 1.0 * s.magBase + s.arcane * 0.9,
    effect: { type: 'lifetap', ratio: 0.6 },
  },
  healdark: {
    id: 'healdark', name: 'Чёрное причастие', class: 'defiler', level: 4, kind: 'active',
    cost: { mp: 26 }, cd: 10, target: 'self',
    desc: 'Вытягивает силу из земли и трупов: лечит вас за каждого убитого недавно (мин. 15 HP).',
    effect: { type: 'darkheal', base: 15, perKill: 6 },
  },
  rotburst: {
    id: 'rotburst', name: 'Гнойный разрыв', class: 'defiler', level: 6, kind: 'active',
    cost: { mp: 24 }, cd: 12, target: 'point', range: 14, radius: 3.5, duration: 6,
    desc: 'Порча в земле взрывается при снятии: AoE-урон гниением.',
    power: (s) => 0.7 * s.magBase + s.arcane * 0.6,
    effect: { type: 'dotZone', duration: 6 },
  },
  toxiccloud: {
    id: 'toxiccloud', name: 'Усыпляющий туман', class: 'mage', level: 5, kind: 'active',
    cost: { mp: 22 }, cd: 14, target: 'point', range: 14, radius: 4.2, duration: 6,
    desc: 'Спящий газ: враги в тумане замедляются и засыпают (не могут атаковать).',
    power: (s) => 0.3 * s.magBase,
    effect: { type: 'sleep', duration: 2.5 },
  },
  // --- Орден Неугасимого Света -------------------------------------------
  solarbeam: {
    id: 'solarbeam', name: 'Солнечный луч', class: 'purifier', level: 3, kind: 'active',
    cost: { mp: 26 }, cd: 8, target: 'point', range: 20, radius: 1.2, pierce: 3,
    desc: 'Реактор выплёвывает концентрированный луч сквозь строй врагов по прямой.',
    power: (s) => 1.6 * s.magBase + s.arcane * 1.2,
  },
  lightward: {
    id: 'lightward', name: 'Орденский светоч', class: 'purifier', level: 6, kind: 'active',
    cost: { mp: 20 }, cd: 18, target: 'self', radius: 8, duration: 8,
    desc: 'Аура ярчайшего света: союзники в радиусе регенерируют, химеры горят периодическим уроном.',
    power: (s) => 0.4 * s.magBase,
    effect: { type: 'holyAura', regen: 3 },
  },
  cleansestrike: {
    id: 'cleansestrike', name: 'Цеп Очищения', class: 'exorcist', level: 2, kind: 'active',
    cost: { mp: 8 }, cd: 3, target: 'enemy', range: 6,
    desc: 'Удар цепом: вешает Метку Очищения. Пятая метка — взрыв священным пламенем по площади.',
    power: (s) => 1.2 * s.dmgBase + s.might * 0.6,
    effect: { type: 'mark', max: 5, aoe: 4.5 },
  },
  conviction: {
    id: 'conviction', name: 'Убеждённость', class: 'exorcist', level: 7, kind: 'passive',
    cost: {}, cd: 0, target: 'self',
    desc: 'Пассивно: +10% шанса блока и блок возвращает священный урон атакующему.',
    effect: { type: 'blockBonus', value: 10, holy: true },
  },
  ashfall: {
    id: 'ashfall', name: 'Метеоритный пепел', class: 'ashherald', level: 4, kind: 'active',
    cost: { mp: 30 }, cd: 13, target: 'point', range: 16, radius: 4, duration: 8,
    desc: 'Пепел падает с неба: урон, −мана врагам, оставляет Святую золу (+скорость каста людям).',
    power: (s) => 0.8 * s.magBase + s.arcane * 0.7,
    effect: { type: 'holyAsh', castSpeed: 0.15 },
  },
  cinderveil: {
    id: 'cinderveil', name: 'Пепельная вуаль', class: 'ashherald', level: 8, kind: 'active',
    cost: { mp: 24 }, cd: 20, target: 'self', duration: 6,
    desc: 'Пелена тлеющего пепла скрывает вас: химеры теряют агро, атаки врагов чаще промахиваются.',
    effect: { type: 'veiled', missChance: 30, duration: 6 },
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
