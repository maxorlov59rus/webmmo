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
