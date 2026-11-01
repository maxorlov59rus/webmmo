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
  { id: 'nwm-1', name: 'Первый Костёр', pop: 'высокая', ping: 24, desc: 'Старейшая застава Эфирии. Полный лут-таблица, PvP-флаг включён после 15 уровня.', seed: 20261102 },
  { id: 'nwm-2', name: 'Люминитовый Разлом', pop: 'средняя', ping: 38, desc: 'Шахты Гильдии: вдвое больше руды и светокамня, но химеры агрессивнее.', seed: 770211 },
  { id: 'nwm-3', name: 'Пепел Аэрии', pop: 'низкая', ping: 51, desc: 'Руины летающего города Синдиката. Подземелья, контрабанда, тёмные рынки.', seed: 411007 },
  { id: 'nwm-4', name: 'Сумеречная Роща', pop: 'высокая', ping: 31, desc: 'Леса Детей Сумерек: ручные химеры, редкие травы, ночные туманы.', seed: 902113 },
];

// ============================================================
//  ЛОКАЦИИ ЭФИРИИ — привязаны к миру; центр каждой локации
//  смещается от спавна игрока на anchor*10 метров.
// ============================================================
export const LOCATIONS = {
  outpost: {
    id: 'outpost', name: 'Ночная Застава', world: 'nwm-1', icon: '⚑', color: '#7fa8d9',
    levelRange: [1, 12], safe: true, anchor: [0, 0], radius: 16,
    desc: 'Круглый палисад из обожжённых свай вокруг геотермальной трещины. Здесь горит единственный на мили вокруг горн, торгует ведьма и считает дозоры сержант. Свет факелов — единственная граница между ремеслом и кормом для химер.',
    npcs: ['dormir', 'ilva', 'serj', 'gilda', 'bruno'],
    spawns: [],
    features: ['Кузница Дормира', 'Шатёр травницы', 'Досмотровая вышка', 'Костёр часовой'],
  },
  hollow: {
    id: 'hollow', name: 'Выгоршая Пустошь', world: 'nwm-1', icon: '☄', color: '#e8a33d',
    levelRange: [2, 6], safe: false, anchor: [-3.2, -2.6], radius: 26,
    desc: 'Здесь падал когда-то «луч» — так говорят старые. Земля спеклась в стекло, воздух звенит от окалины, а волки приходят сюда греться об ещё тёплые прожилки люминита. Порождает руду на поверхности: копай где угодно.',
    npcs: [],
    spawns: [['wolf', 10, 9], ['wraith', 3, 14]],
    features: ['Стеклянные воронки', 'Рассевшийся курган', 'Поверхностная руда'],
  },
  barrow: {
    id: 'barrow', name: 'Курганы Первых Дозоров', world: 'nwm-1', icon: '☠', color: '#b48ce8',
    levelRange: [4, 9], safe: false, anchor: [2.6, -3.4], radius: 24,
    desc: 'Пять курганов тех, кто держал заставу до нас. Ночью они встают — неупокоенные часовые всё ещё ждут смены. У погасших кострищ их можно взять по одному; у большого костра — только бегом.',
    npcs: [],
    spawns: [['skeleton', 9, 10], ['bone_colossus', 1, 18]],
    features: ['Кострища неупокоенных', 'Большой курган', 'Лунный камень в насыпях'],
  },
  pinewood: {
    id: 'pinewood', name: 'Сумеречный Бор', world: 'nwm-1', icon: '🌙', color: '#6fcf97',
    levelRange: [6, 12], safe: false, anchor: [3.4, 3.2], radius: 30,
    desc: 'Лес, который научился дышать во тьме. Дети Сумерек ставят тут тотемы и кличут ручных химер; дикие тени скользят между стволов и гасят факелы одним касанием. Чем глубже чаща — тем меньше видно и тем жирнее добыча.',
    npcs: ['maera'],
    spawns: [['shade', 8, 12], ['chimera_cub', 4, 15]],
    features: ['Тотемы сумерека', 'Гнездовья теней', 'Травы Детей Сумерек'],
  },
  minecamp: {
    id: 'minecamp', name: 'Разрытая Шахта', world: 'nwm-2', icon: '⛏', color: '#ff8a4a',
    levelRange: [3, 10], safe: false, anchor: [-3.0, 2.8], radius: 26,
    desc: 'Горняцкий лагерь Гильдии Золотого Горна: паровые подъёмники стонут всю ночь, люминит светится из-под ног. Гном-прораб Бруно сдаёт задания на расчистку забоев — и на то, что живёт в этих забоях.',
    npcs: ['bruno'],
    spawns: [['golem_lum', 5, 13], ['skeleton', 6, 11], ['wolf', 4, 9]],
    features: ['Забой №4', 'Люминитовые жилы', 'Паровой подъёмник', 'Ствол шахты с деревянной клетью', 'Факелы вдоль выработки'],
  },
  aeriadocks: {
    id: 'aeriadocks', name: 'Причалы Аэрии', world: 'nwm-3', icon: '⚓', color: '#9b7fd4',
    levelRange: [5, 14], safe: false, anchor: [2.8, 3.4], radius: 28,
    desc: 'Пришвартованные обломки летающего города, ставшие базаром Теневого Синдиката. Контрабандный свет продаётся фонарь за фонарём, мейстерица Мэйра торгует ядами и слухами. Плати — и тьма станет товарной категорией.',
    npcs: ['maera'],
    spawns: [['wraith', 7, 12], ['shade', 5, 13], ['overseer', 1, 20]],
    features: ['Тёмный рынок', 'Мачты-краны', 'Склады люмен-фонарей', 'Кренящийся корпус галеры Аэрии', 'Лесточные мостки над смогом'],
  },
  grove: {
    id: 'grove', name: 'Роща Шепчущих Кострей', world: 'nwm-4', icon: '🍂', color: '#6fcf97',
    levelRange: [4, 13], safe: true, anchor: [-2.6, -3.2], radius: 26,
    desc: 'Стоянка Детей Сумерек: костры горят зелёным, ручные химеры спят на лавах, как собаки. Здесь учат слушать тьму вместо того чтобы жечь. Чужакам разрешено стоять у огня — и торговать.',
    npcs: ['maera', 'ilva'],
    spawns: [['chimera_cub', 6, 10], ['shade', 4, 15]],
    features: ['Зелёные костры', 'Вольеры химер', 'Лунные травы'],
  },
  ashfields: {
    id: 'ashfields', name: 'Пепельное Поле', world: null, icon: '✥', color: '#ffd76a',
    levelRange: [8, 15], safe: false, anchor: [3.6, -3.6], radius: 32,
    desc: 'Поле последнего боя Ордена Неугасимого Света: зола хранит тепло триста лет. Надзиратель Ночи бродит здесь, потому что жрёт то, что боится света, — а другого вокруг ничего нет. Идти следует толпой или не идти вовсе.',
    npcs: [],
    spawns: [['overseer', 1, 18], ['wraith', 6, 13], ['golem_lum', 3, 16]],
    features: ['Чёрный монолит', 'Зола святого пожара', 'Лежбище Надзирателя'],
  },
};
export const LOCATION_KEYS = Object.keys(LOCATIONS);
export function locationsForWorld(worldId) {
  // world: null — локация доступна на всех мирах (общие охотничьи угодья)
  return LOCATION_KEYS
    .filter(k => LOCATIONS[k].world === worldId || LOCATIONS[k].world === null)
    .map(k => LOCATIONS[k]);
}
export function locationById(id) { return LOCATIONS[id] || null; }

// Ближайшая локация к точке карты (для HUD «вы здесь»)
export function locationAt(x, z) {
  let best = null, bestD = Infinity;
  for (const k of LOCATION_KEYS) {
    const L = LOCATIONS[k];
    const cx = L.anchor[0] * 10, cz = L.anchor[1] * 10;
    const d = Math.hypot(x - cx, z - cz);
    if (d < bestD) { bestD = d; best = L; }
  }
  return best;
}

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

  // Новое оружие и броня (крафт из трофеев химер и Ордена)
  chimera_fang_dagger: { id: 'chimera_fang_dagger', name: 'Клык-стилет химеры', slot: 'weapon', rarity: 3, dmg: [9, 15], speed: 1.25, mods: { agility: 3, crit: 8 }, lore: 'Тотемный клык, заострённый до предела. Яд в канале ещё живой.' },
  ashen_plate:   { id: 'ashen_plate', name: 'Пепельные латы', slot: 'body', rarity: 4, armor: [5, 9], mods: { ward: 6, arcane: 3, hp: 30 }, lore: 'Сняты с инквизитора. Пахнут гарью и ересью одновременно.' },
  lumlantern:    { id: 'lumlantern', name: 'Люмен-фонарь', slot: 'trinket', rarity: 3, mods: { wit: 4, light: 8 }, lore: 'Контрабандный свет Синдиката. Тьма делает вид, что не обижается.' },

  // Расходники
  health_potion:   { id: 'health_potion', name: 'Зелье лечения', slot: 'none', stack: true, use: { type: 'heal', value: 60 } },
  mana_potion:     { id: 'mana_potion', name: 'Зелье маны', slot: 'none', stack: true, use: { type: 'mana', value: 50 } },
  poison_vial:     { id: 'poison_vial', name: 'Флакон яда глубин', slot: 'none', stack: true, use: { type: 'buffPower', value: 15, duration: 20 } },
  phosphor_grenade:{ id: 'phosphor_grenade', name: 'Фосфорная граната', slot: 'none', stack: true, use: { type: 'flash', radius: 7 } },

  // Материалы
  iron_ore:        { id: 'iron_ore', name: 'Железная руда', slot: 'none', stack: true, mat: true },
  moonstone:       { id: 'moonstone', name: 'Лунный камень', slot: 'none', stack: true, mat: true },
  lum_shard:       { id: 'lum_shard', name: 'Осколок люминита', slot: 'none', stack: true, mat: true, lore: 'Тёплый изнутри. Гильдия платит за тепло.' },
  chimera_hide:    { id: 'chimera_hide', name: 'Шкура химеры', slot: 'none', stack: true, mat: true },
  wraith_essence:  { id: 'wraith_essence', name: 'Эссенция упыря', slot: 'none', stack: true, mat: true },
  bone_fragment:   { id: 'bone_fragment', name: 'Костяная фракция', slot: 'none', stack: true, mat: true },
  colossus_skull:  { id: 'colossus_skull', name: 'Череп Костяного Колосса', slot: 'none', stack: false, quest: true },
  inquisitor_mask: { id: 'inquisitor_mask', name: 'Маска инквизитора', slot: 'none', stack: false, quest: true, lore: 'Латунь, трещина пополам и запах чужого рая.' },
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
  { out: 'lumlantern',   mats: { lum_shard: 2, iron_ore: 1 }, time: 2.5, reqLevel: 3 },
  { out: 'chimera_fang_dagger', mats: { chimera_hide: 2, lum_shard: 1 }, time: 2.5, reqLevel: 4 },
  { out: 'ashen_plate',  mats: { wraith_essence: 3, iron_ore: 4 }, time: 3.5, reqLevel: 6 },
  { out: 'health_potion', mats: { moonstone: 1 }, time: 1.0, reqLevel: 1 },
  { out: 'mana_potion',   mats: { iron_ore: 1 }, time: 1.0, reqLevel: 1 },
];

// --- Квесты ------------------------------------------------------------------
// location — id локации; kill: mob+count; collect: item+count; talk: npc; escort/gather: point
export const QUESTS = [
  // ======= Застава: стартовая цепочка =======
  {
    id: 'q_firstlight', name: 'Первый рассвет не было', loc: 'outpost', giver: 'serj', color: '#7fa8d9',
    hint: 'Сержант Вьюг хочет, чтобы ты привык к ночи до того, как ночь привыкнет к тебе.',
    steps: [
      { text: 'Поговори с сержантом Вьюгом на плацу.', type: 'talk', npc: 'serj' },
      { text: 'Перебей тенивых волков у палисада (4).', type: 'kill', mob: 'wolf', count: 4 },
      { text: 'Вернись к сержанту с докладом.', type: 'talk', npc: 'serj' },
    ],
    reward: { xp: 70, gold: 20, items: ['health_potion'], rep: { forge: 5 } },
  },
  {
    id: 'q_forge', name: 'Ночь Военного Ремесла', loc: 'outpost', giver: 'dormir', color: '#ffb64a',
    hint: 'Без свитка Дормир выкуёт тебе только гвоздь. Свиток носит Надзиратель Ночи.',
    steps: [
      { text: 'Отыщи Свиток Ночного Кузнечного Дела.', type: 'collect', item: 'scroll_nightforge', count: 1 },
      { text: 'Принеси свиток Дормиру Молоту.', type: 'talk', npc: 'dormir' },
    ],
    reward: { xp: 120, gold: 40, items: ['moonstone', 'moonstone'], rep: { forge: 10 } },
  },
  {
    id: 'q_wolves', name: 'Стая у стены', loc: 'hollow', giver: 'dormir', color: '#7fa8d9',
    hint: 'Тенивые волки рыщут у Выгоршей Пустоши и гасят путевые факелы.',
    steps: [
      { text: 'Перебей тенивых волков (6).', type: 'kill', mob: 'wolf', count: 6 },
      { text: 'Доложи Дормиру Молоту.', type: 'talk', npc: 'dormir' },
    ],
    reward: { xp: 90, gold: 25, items: ['health_potion', 'health_potion'], rep: { forge: 6 } },
  },
  {
    id: 'q_ore', name: 'Руда для горна', loc: 'hollow', giver: 'gilda', color: '#e8a33d',
    hint: 'Гильда Торговый Путь закупает железную руду — без неё её лавка превратится в склад пустых бочек.',
    steps: [
      { text: 'Добудь железную руду (6).', type: 'collect', item: 'iron_ore', count: 6 },
      { text: 'Продай/принеси руду Гильде в лавку.', type: 'talk', npc: 'gilda' },
    ],
    reward: { xp: 80, gold: 45, items: ['lum_shard'], rep: { umbral: 6 } },
  },
  {
    id: 'q_lanterns', name: 'Фонарь против тьмы', loc: 'outpost', giver: 'gilda', color: '#9b7fd4',
    hint: 'Контрабандный люмен всё ещё светит. Собери осколки люминита — Гильда спаяет фонарь.',
    steps: [
      { text: 'Принеси 3 осколка люминита.', type: 'collect', item: 'lum_shard', count: 3 },
      { text: 'Забери готовый люмен-фонарь у Гильды.', type: 'talk', npc: 'gilda' },
    ],
    reward: { xp: 110, gold: 30, items: ['lumlantern'], rep: { umbral: 8 } },
  },
  // ======= Курганы: скелетная линия =======
  {
    id: 'q_bones', name: 'Кости у костра', loc: 'barrow', giver: 'ilva', color: '#b48ce8',
    hint: 'Неупокоенные поднимаются у старых кострищ курганов. Очисти место — Илве нужны их мозговые камни.',
    steps: [
      { text: 'Уничтожь неупокоенных воинов (5).', type: 'kill', mob: 'skeleton', count: 5 },
      { text: 'Доложи Ведьме Илве у шатра.', type: 'talk', npc: 'ilva' },
    ],
    reward: { xp: 140, gold: 50, items: ['mana_potion', 'ember_ring'], rep: { dusk: 6 } },
  },
  {
    id: 'q_colossus', name: 'Тот, кто ждал смены', loc: 'barrow', giver: 'serj', color: '#c07ff0',
    hint: 'Костяной Колосс — часовой Первого Дозора. Он так и не получил приказа лечь.',
    steps: [
      { text: 'Спусти Костяного Колосса с большого кургана.', type: 'kill', mob: 'bone_colossus', count: 1 },
      { text: 'Принеси череп колосса сержанту Вьюгу.', type: 'collect', item: 'colossus_skull', count: 1 },
      { text: 'Доложи сержанту.', type: 'talk', npc: 'serj' },
    ],
    reward: { xp: 220, gold: 80, items: ['sentinel_charm'], rep: { forge: 12, order: 6 } },
  },
  {
    id: 'q_moonstone', name: 'Лунный камень из насыпей', loc: 'barrow', giver: 'ilva', color: '#5aa9ff',
    hint: 'Курганы держат в себе лунный камень — слёзы луны, въевшиеся в кости.',
    steps: [
      { text: 'Собери лунный камень (5).', type: 'collect', item: 'moonstone', count: 5 },
      { text: 'Отнеси камни Илве.', type: 'talk', npc: 'ilva' },
    ],
    reward: { xp: 130, gold: 40, items: ['mana_potion', 'mana_potion'], rep: { dusk: 8 } },
  },
  // ======= Бор: химерья линия =======
  {
    id: 'q_whisper', name: 'Шёпот между стволов', loc: 'pinewood', giver: 'maera', color: '#6fcf97',
    hint: 'Мэйра слышит, как бор зовёт своих мертвецов обратно. Тени в чаще — это эхо, ставшее зубами.',
    steps: [
      { text: 'Поговори с Мэйрой у тотема.', type: 'talk', npc: 'maera' },
      { text: 'Разведай о шёпоте: убей ночных теней в бору (5).', type: 'kill', mob: 'shade', count: 5 },
      { text: 'Вернись к Мэйре с ответом.', type: 'talk', npc: 'maera' },
    ],
    reward: { xp: 180, gold: 60, items: ['duskweave'], rep: { dusk: 12 } },
  },
  {
    id: 'q_cubs', name: 'Коготь и шкура', loc: 'pinewood', giver: 'maera', color: '#8fd18f',
    hint: 'Дикие детёныши химер портят ручных. Шкура целого детёныша стоит дороже мечи среднего качества.',
    steps: [
      { text: 'Добудь шкуры детёнышей химеры (4).', type: 'collect', item: 'chimera_hide', count: 4 },
      { text: 'Принеси шкуры Мэйре.', type: 'talk', npc: 'maera' },
    ],
    reward: { xp: 160, gold: 55, items: ['poison_vial', 'poison_vial'], rep: { dusk: 10 } },
  },
  {
    id: 'q_torches', name: 'Погашенные факелы', loc: 'pinewood', giver: 'serj', color: '#ff8a4a',
    hint: 'Кто-то гасит путевые факелы к бору. Без света тропа перестаёт существовать.',
    steps: [
      { text: 'Убей упырей на тропе к бору (4).', type: 'kill', mob: 'wraith', count: 4 },
      { text: 'Доложи сержанту Вьюгу.', type: 'talk', npc: 'serj' },
    ],
    reward: { xp: 170, gold: 65, items: ['lum_shard', 'lum_shard'], rep: { forge: 8 } },
  },
  // ======= Шахта: люминитовая линия (Горн) =======
  {
    id: 'q_stope', name: 'Забой №4', loc: 'minecamp', giver: 'bruno', color: '#ff8a4a',
    hint: 'Прораб Бруно Железнобокий платит за то, что шахта снова дышит, а не хрипит.',
    steps: [
      { text: 'Поговори с прорабом Бруно у подъёмника.', type: 'talk', npc: 'bruno' },
      { text: 'Выбей люминитовых големов из забоя (5).', type: 'kill', mob: 'golem_lum', count: 5 },
      { text: 'Доложи Бруно: забой чист.', type: 'talk', npc: 'bruno' },
    ],
    reward: { xp: 200, gold: 90, items: ['lum_shard', 'lum_shard', 'lum_shard'], rep: { forge: 15 } },
  },
  {
    id: 'q_deepvein', name: 'Жила глубже сердца', loc: 'minecamp', giver: 'bruno', color: '#ffd76a',
    hint: 'Глубинный люминит тёплый на ощупь. Три куска — и подъёмник снова тянет клеть.',
    steps: [
      { text: 'Добудь 8 осколков люминита.', type: 'collect', item: 'lum_shard', count: 8 },
      { text: 'Принеси люминит прорабу.', type: 'talk', npc: 'bruno' },
    ],
    reward: { xp: 210, gold: 110, items: ['runesplitter'], rep: { forge: 14 } },
  },
  // ======= Причалы Аэрии: линия Синдиката =======
  {
    id: 'q_debt', name: 'Долг Аэрии', loc: 'aeriadocks', giver: 'maera', color: '#9b7fd4',
    hint: 'Синдикат не прощает — Синдикат пересчитывает. Мэйра должна кое-кому свет. Ты заплатишь эссенцией.',
    steps: [
      { text: 'Собери 5 эссенций упыря с причалов.', type: 'collect', item: 'wraith_essence', count: 5 },
      { text: 'Передай эссенции Мэйре на тёмном рынке.', type: 'talk', npc: 'maera' },
    ],
    reward: { xp: 230, gold: 130, items: ['phosphor_grenade'], rep: { umbral: 15 } },
  },
  {
    id: 'q_smuggle', name: 'Контрабанда света', loc: 'aeriadocks', giver: 'gilda', color: '#c8c8c8',
    hint: 'Гильда ведёт «бухгалтерию». Фонарь, который числится потерянным, светит вдвое веселее.',
    steps: [
      { text: 'Очисти склады от упырей (6).', type: 'kill', mob: 'wraith', count: 6 },
      { text: 'Заберись на мачту: принеси 2 люмен-фонаря со склада.', type: 'collect', item: 'lumlantern', count: 2 },
      { text: 'Отчитайся Гильде.', type: 'talk', npc: 'gilda' },
    ],
    reward: { xp: 240, gold: 120, items: ['moonsignet'], rep: { umbral: 12, forge: -5 } },
  },
  // ======= Охота на боссов (общая линия) =======
  {
    id: 'q_overseer', name: 'Надзиратель Ночи', loc: 'ashfields', giver: 'serj', color: '#c07ff0',
    hint: 'Он пасёт химер, как пастух овечье стадо. Пока он дышит — застава считает не дни, а факелы.',
    steps: [
      { text: 'Найди и уничтожь Надзирателя Ночи.', type: 'kill', mob: 'overseer', count: 1 },
      { text: 'Доложи сержанту Вьюгу.', type: 'talk', npc: 'serj' },
    ],
    reward: { xp: 400, gold: 200, items: ['moonstone', 'moonstone', 'lum_shard'], rep: { forge: 20, order: 10 } },
  },
  {
    id: 'q_inquisitor', name: 'Ересь яркого света', loc: 'ashfields', giver: 'ilva', color: '#ffd76a',
    hint: 'Инквизитор Эонглор сжёг три гнезда вместе с тремя деревнями. Илва предлагает решить вопрос тьмой.',
    steps: [
      { text: 'Уничтожь Инквизитора Эонглора.', type: 'kill', mob: 'inquisitor', count: 1 },
      { text: 'Принеси его маску Илве.', type: 'collect', item: 'inquisitor_mask', count: 1 },
      { text: 'Доложи Илве.', type: 'talk', npc: 'ilva' },
    ],
    reward: { xp: 460, gold: 220, items: ['ashen_plate'], rep: { dusk: 20, order: -15 } },
  },
];
export function questById(qid) { return QUESTS.find(q => q.id === qid) || null; }
export function questsForNpc(npcId) { return QUESTS.filter(q => q.giver === npcId); }
export function questsForLocation(locId) { return QUESTS.filter(q => q.loc === locId); }

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
    loot: [['iron_ore', 0.4], ['moonstone', 0.15], ['bone_fragment', 0.5], ['mail_hauberk', 0.06]],
  },
  shade: {
    id: 'shade', name: 'Ночная Тень', level: 6, hp: 110, dmg: [10, 16], speed: 3.0,
    xp: 55, gold: [8, 18], aggro: 13, attackRange: 2.2, respawn: 22, shape: 'shade',
    loot: [['moonstone', 0.3], ['duskweave', 0.07], ['nightfall_blade', 0.04], ['lum_shard', 0.12]],
  },
  wraith: {
    id: 'wraith', name: 'Упырь Пепелища', level: 7, hp: 130, dmg: [11, 18], speed: 3.4,
    xp: 70, gold: [10, 22], aggro: 14, attackRange: 1.9, respawn: 24, shape: 'wraith',
    loot: [['wraith_essence', 0.45], ['mana_potion', 0.15], ['lum_shard', 0.18], ['ember_ring', 0.05]],
  },
  chimera_cub: {
    id: 'chimera_cub', name: 'Детёныш химеры', level: 8, hp: 165, dmg: [13, 20], speed: 3.8,
    xp: 88, gold: [12, 26], aggro: 12, attackRange: 2.1, respawn: 26, shape: 'chimera',
    loot: [['chimera_hide', 0.6], ['poison_vial', 0.25], ['moonstone', 0.2], ['chimera_fang_dagger', 0.05]],
  },
  golem_lum: {
    id: 'golem_lum', name: 'Люминитовый голем', level: 9, hp: 240, dmg: [15, 24], speed: 1.9,
    xp: 110, gold: [16, 34], aggro: 10, attackRange: 2.4, respawn: 30, shape: 'golem',
    loot: [['lum_shard', 0.7], ['iron_ore', 0.5], ['sentinel_charm', 0.06], ['runesplitter', 0.03]],
  },
  bone_colossus: {
    id: 'bone_colossus', name: 'Костяной Колосс', level: 11, hp: 420, dmg: [18, 28], speed: 2.1,
    xp: 210, gold: [40, 80], aggro: 15, attackRange: 3.0, respawn: 90, shape: 'colossus', boss: true, elite: true,
    loot: [['colossus_skull', 1.0], ['warden_plate', 0.15], ['moonsignet', 0.1], ['moonstone', 0.6]],
  },
  inquisitor: {
    id: 'inquisitor', name: 'Инквизитор Эонглор', level: 13, hp: 560, dmg: [22, 34], speed: 2.5,
    xp: 300, gold: [70, 130], aggro: 16, attackRange: 2.8, respawn: 120, shape: 'inquisitor', boss: true, elite: true,
    loot: [['inquisitor_mask', 1.0], ['ashen_plate', 0.35], ['stormrod', 0.15], ['phosphor_grenade', 0.4]],
  },
  overseer: {
    id: 'overseer', name: 'Надзиратель Ночи', level: 9, hp: 320, dmg: [14, 22], speed: 2.2,
    xp: 180, gold: [30, 60], aggro: 14, attackRange: 2.6, respawn: 60, shape: 'overseer', boss: true,
    loot: [['runesplitter', 0.18], ['moonspike', 0.18], ['stormrod', 0.18], ['moonsignet', 0.12], ['scroll_nightforge', 0.5], ['lum_shard', 0.5]],
  },
};
export const MOB_KEYS = Object.keys(MOBS);

// --- NPC ---------------------------------------------------------------------
export const NPCS = {
  dormir: { id: 'dormir', name: 'Дормир Молот', role: 'Кузнец · крафт и задания', faction: 'forge', color: '#d98c4a', loc: 'outpost', offset: [6, -4], quests: ['q_forge', 'q_wolves'] },
  ilva:   { id: 'ilva', name: 'Ведьма Илва', role: 'Травница · зелья и обряды', faction: 'dusk', color: '#9a6fd0', loc: 'outpost', offset: [-8, 5], quests: ['q_bones', 'q_moonstone', 'q_inquisitor'] },
  serj:   { id: 'serj', name: 'Сержант Вьюг', role: 'Застава · дозоры и обучение', faction: 'forge', color: '#6fa8d0', loc: 'outpost', offset: [-2, 9], tutorial: true, quests: ['q_firstlight', 'q_colossus', 'q_torches', 'q_overseer'] },
  gilda:  { id: 'gilda', name: 'Гильда Торговый Путь', role: 'Лавка · скупка и контрабанда', faction: 'umbral', color: '#c8b06a', loc: 'outpost', offset: [10, 7], quests: ['q_ore', 'q_lanterns', 'q_smuggle'], trader: true },
  bruno:  { id: 'bruno', name: 'Бруно Железнобокий', role: 'Прораб · шахта и подрывы', faction: 'forge', color: '#ff8a4a', loc: 'minecamp', offset: [0, 0], quests: ['q_stope', 'q_deepvein'] },
  maera:  { id: 'maera', name: 'Мэйра Тихий Яд', role: 'Мейстерица · яды и слухи', faction: 'umbral', color: '#7fe0c8', loc: 'pinewood', offset: [2, -3], quests: ['q_whisper', 'q_cubs', 'q_debt'] },
};
export const NPC_KEYS = Object.keys(NPCS);
export function npcsForWorld(worldId) {
  return NPC_KEYS.filter(k => {
    const npc = NPCS[k];
    const loc = LOCATIONS[npc.loc];
    if (!loc) return false;
    return loc.world === worldId || loc.world === null;
  }).map(k => NPCS[k]);
}

// --- Диалоги -----------------------------------------------------------------
export const DIALOGS = {
  serj: [
    'Застава на ножках, новичок. WASD — ноги, ЛКМ — клинок, ПКМ по врагу — способность.',
    'Ночью тут ремесло военное цветёт. Кузницу найдёшь у Дормира, он не кусается. Обычно.',
    'Считай не дни, а факелы. Кончатся факелы — кончится застава.',
    'Дозор Первых лёг в курганах. Они всё ещё ждут смены. Не мешай им ждать.',
  ],
  dormir: [
    'Пока горит горн — мы куём. Пока не горит — ищем, чем разжечь.',
    'Свиток Ночного Кузнечного Дела у Надзирателя Ночи. Без него я тебе только гвоздь выкую.',
    'Руду тащи Гильде, она торгашка, но счёт знает. Мне неси — я знаю огонь.',
    'Сталь любит ночь. День её калит, а ночь закаляет.',
  ],
  ilva: [
    'Траву я собираю при луне, кости — при звезде. Не путай.',
    'Неупокоенные у кострищ? Вот и славно, значит луна сегодня злая.',
    'Орден молится светом, я молчу тьмой. Разница в том, кто выживет.',
    'Лунный камень в курганах растёт, как зуб в десне мёртвого. Вырви — не обидится.',
  ],
  gilda: [
    'Всё, что светит, можно продать дважды: фонарь и надежду.',
    'Люминит, шкуры, эссенция — неси всё. Я не привередливая, я бухгалтер.',
    'Синдикат платит за тишину. Горн платит за шум. Выбирай, кого слушать.',
    'Контрабандный свет дешевле честного. Тьма всё равно не разбирает.',
  ],
  bruno: [
    'Забой №4 дышит через раз. Внутри — големы из люминита. Разберись — заплатит Гильдия.',
    'Мы тут не магию бутафорим, мы паром и сталью. А стая ваша химерная — материал.',
    'Клеть стоит. Подъёмник молчит. Люминит холодный. Это три плохие новости, четвёртая придёт сама.',
    'Кто в шахте не работал — тот не знает, как звучит тьма изнутри.',
  ],
  maera: [
    'Бор шепчет. Если ты его слышишь — значит, он уже знает твоё имя.',
    'Детёныши портят ручных. Убей диких, шкуры принеси мне, мясо — себе.',
    'Яд — это просто терпение в жидком виде.',
    'Синдикат не прощает долгов. Он их пересчитывает под процент.',
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

// --- Генерированный контент (352 квеста уровней 1–95) ------------------------
import { QUESTS_GEN } from './quests_generated.js';
export const ALL_QUESTS = QUESTS.concat(QUESTS_GEN);
export function questByIdG(qid) { return ALL_QUESTS.find(q => q.id === qid) || null; }
export function questsForNpcG(npcId) { return ALL_QUESTS.filter(q => q.giver === npcId); }

// Инстансовые «врата» — квестодатели у порталов (см. instances.js).
// Фикс: шаг инстансового квеста помечен type==="kill_instance" (или типом kill с
// флагом instance), поэтому детектим по типу шага, а не по тексту/hint.
export const isInstanceQuestStep = (st) => !!st && (st.type === 'kill_instance' || (st.type === 'kill' && st.instance === true));
export const isInstanceQuest = (q) => !!(q && q.steps && q.steps.some(isInstanceQuestStep));
export const INST_GATE_NPCS = {};
for (const q of QUESTS_GEN) {
  if (isInstanceQuest(q)) {
    const gid = 'gate_' + q.loc;
    if (!INST_GATE_NPCS[gid]) INST_GATE_NPCS[gid] = { id: gid, name: 'Врата Инстансов', role: 'Хранитель порогов Долгой Ночи', faction: 'umbral', color: '#c07ff0', loc: q.loc, offset: [4, 4], quests: [] };
    INST_GATE_NPCS[gid].quests.push(q.id);
  }
}
