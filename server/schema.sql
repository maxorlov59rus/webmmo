-- ============================================================
--  НОЧЬ ВОЕННОГО РЕМЕСЛА — схема MySQL (Эфирия, Долгая Ночь)
--  Запуск: mysql -u root -p < schema.sql
--  (или сервер сам применит её при DB_AUTOINIT=1, по умолчанию)
-- ============================================================
CREATE DATABASE IF NOT EXISTS nvr_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nvr_game;

-- Учётные записи (пароль хранится как SHA-256(salt + ':' + password))
CREATE TABLE IF NOT EXISTS accounts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(190) NOT NULL UNIQUE,
  nick        VARCHAR(32)  NOT NULL,
  pass_hash   CHAR(64)     NOT NULL,
  salt        VARCHAR(16)  NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login  TIMESTAMP    NULL
) ENGINE=InnoDB;

-- Миры (зеркала Эфирии)
CREATE TABLE IF NOT EXISTS worlds (
  id       VARCHAR(16) PRIMARY KEY,      -- 'nwm-1' ...
  name     VARCHAR(64) NOT NULL,
  seed     BIGINT NOT NULL,
  pop      VARCHAR(16) NOT NULL DEFAULT 'низкая'
) ENGINE=InnoDB;

-- Персонажи: один на аккаунт в мире
CREATE TABLE IF NOT EXISTS characters (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  world_id   VARCHAR(16)  NOT NULL,
  name       VARCHAR(32)  NOT NULL,
  save_json  LONGTEXT     NOT NULL,      -- serialize() клиента: статы/экипировка/квесты/внешность
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_world_name (world_id, name),
  KEY idx_account (account_id),
  CONSTRAINT fk_char_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CONSTRAINT fk_char_world   FOREIGN KEY (world_id)   REFERENCES worlds(id)
) ENGINE=InnoDB;

-- Глобальный чат мира
CREATE TABLE IF NOT EXISTS chat_log (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  world_id  VARCHAR(16) NOT NULL,
  author    VARCHAR(32) NOT NULL,
  channel   VARCHAR(16) NOT NULL DEFAULT 'global',
  text      VARCHAR(255) NOT NULL,
  ts        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_world_time (world_id, ts)
) ENGINE=InnoDB;

-- Личные сообщения (двусторонние whispers, хранятся построчно)
CREATE TABLE IF NOT EXISTS whispers (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  world_id   VARCHAR(16)  NOT NULL,
  from_name  VARCHAR(32)  NOT NULL,
  to_name    VARCHAR(32)  NOT NULL,
  text       VARCHAR(255) NOT NULL,
  ts         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pair (world_id, from_name, to_name, id),
  KEY idx_to   (to_name, id)
) ENGINE=InnoDB;

-- Системная информация (рассылки ядра/ГМ: вход-выход, анонсы, события)
CREATE TABLE IF NOT EXISTS system_log (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  world_id  VARCHAR(16)  NOT NULL,
  kind      VARCHAR(16)  NOT NULL DEFAULT 'info',   -- info · announce · event · gm
  text      VARCHAR(255) NOT NULL,
  ts        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_world_time (world_id, ts)
) ENGINE=InnoDB;

-- Настройки чат-систем (раздел §3 в deploy.php; читаются ядром при старте)
CREATE TABLE IF NOT EXISTS chat_settings (
  k VARCHAR(48) PRIMARY KEY,
  v VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- Сеансы WS (кто сейчас в игре — для счётчика «онлайн»)
CREATE TABLE IF NOT EXISTS sessions (
  account_id INT UNSIGNED PRIMARY KEY,
  char_name  VARCHAR(32) NOT NULL,
  world_id   VARCHAR(16) NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sess_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ГМ-учётные записи (создаются скриптом развертывания deploy.php)
CREATE TABLE IF NOT EXISTS gm_accounts (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL UNIQUE,
  gm_level   TINYINT UNSIGNED NOT NULL DEFAULT 1,        -- 1 модератор · 2 ГМ · 3 старший ГМ · 9 владелец
  perms      TEXT          NULL,                          -- JSON: ["*"] или список прав
  note       VARCHAR(120)  NOT NULL DEFAULT '',
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gm_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Журнал действий ГМ (админ-аудит)
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gm_email   VARCHAR(190) NOT NULL,
  command    VARCHAR(48)  NOT NULL,
  args       VARCHAR(500) NOT NULL DEFAULT '',
  result     VARCHAR(255) NOT NULL DEFAULT '',
  ts         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ts (ts)
) ENGINE=InnoDB;

-- Стартовые миры (совпадают с WORLDS клиента, src/data/consts.js)
INSERT INTO worlds (id, name, seed, pop) VALUES
  ('nwm-1', 'Первый Костёр',      20261102, 'высокая'),
  ('nwm-2', 'Люминитовый Разлом',  770211,  'средняя'),
  ('nwm-3', 'Пепел Аэрии',         411007,  'низкая'),
  ('nwm-4', 'Сумеречная Роща',     902113,  'высокая')
ON DUPLICATE KEY UPDATE name=VALUES(name), seed=VALUES(seed);

-- ============================================================
--  ИНСТАНСЫ: справочник зон, замки (locks), прогресс и квесты
-- ============================================================
CREATE TABLE IF NOT EXISTS instances (
  id         VARCHAR(16) PRIMARY KEY,          -- 'inst_01' ...
  num        INT UNSIGNED NOT NULL,
  name       VARCHAR(96) NOT NULL,
  theme      VARCHAR(64) NOT NULL,
  base_loc   VARCHAR(32) NOT NULL,
  difficulty ENUM('normal','heroic','mythic') NOT NULL DEFAULT 'normal',
  size       TINYINT UNSIGNED NOT NULL DEFAULT 1,     -- 1 соло | 5 группа | 10 рейд
  level_min  TINYINT UNSIGNED NOT NULL,
  level_max  TINYINT UNSIGNED NOT NULL,
  waves      TINYINT UNSIGNED NOT NULL DEFAULT 3,
  boss_mob   VARCHAR(32) NOT NULL,
  timer_min  SMALLINT UNSIGNED NOT NULL DEFAULT 45,
  key_req    VARCHAR(32) NULL,
  reward_xp  INT UNSIGNED NOT NULL DEFAULT 0,
  reward_gold INT UNSIGNED NOT NULL DEFAULT 0,
  loot_json  TEXT NULL,
  enabled    TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_inst_num (num)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS instance_locks (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  world_id   VARCHAR(16) NOT NULL,
  inst_id    VARCHAR(16) NOT NULL,
  diff       ENUM('normal','heroic','mythic') NOT NULL DEFAULT 'normal',
  leader_name VARCHAR(32) NOT NULL,
  party_json TEXT NULL,                          -- состав (ники игроков/ботов)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,                  -- сброс lock ID (например, недельный)
  completed  TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_lock_world (world_id, leader_name),
  CONSTRAINT fk_lock_inst FOREIGN KEY (inst_id) REFERENCES instances(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS instance_progress (
  lock_id    BIGINT UNSIGNED NOT NULL,
  wave_no    TINYINT UNSIGNED NOT NULL,
  cleared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mobs_killed INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (lock_id, wave_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quests (
  id         VARCHAR(24) PRIMARY KEY,            -- 'q_g001' / 'q_forge'...
  name       VARCHAR(128) NOT NULL,
  quest_lvl  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  loc        VARCHAR(32) NOT NULL,
  giver      VARCHAR(32) NOT NULL,
  chain      VARCHAR(64) NULL,
  hint       VARCHAR(255) NULL,
  steps_json TEXT NOT NULL,
  reward_json TEXT NOT NULL,
  is_instance TINYINT(1) NOT NULL DEFAULT 0,
  enabled    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS character_quests (
  char_id    INT UNSIGNED NOT NULL,
  quest_id   VARCHAR(24) NOT NULL,
  step_no    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  progress   INT UNSIGNED NOT NULL DEFAULT 0,
  state      ENUM('active','done','failed') NOT NULL DEFAULT 'active',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (char_id, quest_id),
  CONSTRAINT fk_cq_char  FOREIGN KEY (char_id)  REFERENCES characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_cq_quest FOREIGN KEY (quest_id) REFERENCES quests(id)
) ENGINE=InnoDB;
