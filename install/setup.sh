#!/usr/bin/env bash
# ============================================================
#  НОЧЬ ВОЕННОГО РЕМЕСЛА — установка сервера + MySQL (Linux/macOS)
#  Использование:  ./install/setup.sh [--no-db]
#    --no-db : пропустить развертывание БД (сервер запустится с NO_DB=1)
# ============================================================
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  НОЧЬ ВОЕННОГО РЕМЕСЛА — подготовка к запуску"
echo "============================================================"

# 1. Node.js
if ! command -v node >/dev/null; then
  echo "[ОШИБКА] Node.js не найден. Установите LTS 18+ (https://nodejs.org)."; exit 1
fi
echo "[OK] Node.js $(node -v)"

# 2. .env
if [ ! -f ../server/.env ]; then
  cp ../server/.env.example ../server/.env
  echo "[OK] Создан server/.env (при необходимости отредактируйте DB_USER/DB_PASS)."
else
  echo "[OK] server/.env уже существует."
fi
# читаем параметры
set -a; . ../server/.env; set +a
PORT=${PORT:-3000}; DB_HOST=${DB_HOST:-127.0.0.1}; DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}; DB_NAME=${DB_NAME:-nvr_game}; DB_PASS=${DB_PASS:-}

# 3. npm install
echo "[*] Установка зависимостей сервера..."
(cd ../server && npm install --no-audit --no-fund)
echo "[OK] Зависимости установлены."

# 4. Развертывание БД
if [ "$1" == "--no-db" ]; then
  sed -i.bak 's/^NO_DB=.*/NO_DB=1/' ../server/.env && rm -f ../server/.env.bak
  echo "[OK] Выбран режим без MySQL (NO_DB=1)."
elif command -v mysql >/dev/null; then
  echo "[*] Применяю схему к MySQL на $DB_HOST:$DB_PORT..."
  if [ -n "$DB_PASS" ]; then
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" < ../server/schema.sql
  else
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" < ../server/schema.sql
  fi
  echo "[OK] База '$DB_NAME' и таблицы готовы."
else
  echo "[ВНИМАНИЕ] Клиент 'mysql' не найден — схема будет создана сервером при старте (DB_AUTOINIT=1)."
fi

echo ""
echo "============================================================"
echo "  УСТАНОВКА ЗАВЕРШЕНА"
echo "  Запуск:  node server/server.js   (или ./install/start-server.sh)"
echo "  Игра:    http://localhost:$PORT/?api=http://localhost:$PORT&server=ws://localhost:$PORT/ws"
echo "============================================================"
