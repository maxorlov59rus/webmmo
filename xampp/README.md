# ⚒ Развертывание «Ночь Военного Ремесла» на XAMPP (Windows)

PHP-панель `deploy.php` разворачивает полный стек: **Apache/PHP + Node.js-игросервер + MySQL (MariaDB из XAMPP)**.

## Быстрый старт (Windows + XAMPP)
1. Установите [XAMPP](https://www.apachefriends.org) и [Node.js LTS](https://nodejs.org).
2. Скопируйте файлы игры в `C:\xampp\htdocs\nvr-game\`.
3. Скопируйте эту папку (`xampp/`) → `C:\xampp\htdocs\nvr-deploy\`.
4. В панели XAMPP запустите **Apache** и **MySQL**.
5. Откройте `http://localhost/nvr-deploy/deploy.php`:
   - §1 проверьте окружение (все точки зелёные), при необходимости укажите корень игры;
   - §2 «Сохранить конфиг» → «▶ Развернуть базу» (создаст `nvr_game`: accounts/worlds/characters/chat_log + 4 мира);
   - §3 задайте рейты/лимиты → «Сохранить server/.env»;
   - §4 «npm install» (один раз) → «▶ Запустить»;
   - играйте: `http://localhost:3000/?api=http://localhost:3000&server=ws://localhost:3000/ws`.

## Публичный сервер
§5 панели: `PUBLIC_MODE=1` (bind 0.0.0.0) → сохранить → перезапустить сервер → добавить правила брандмауэра (netsh, готовая команда в панели) → пробросить TCP-порт на роутере. Ссылка для игроков генерируется автоматически с вашим IP/доменом (`PUBLIC_HOST`). Для :80 — готовый Apache-vhost с проксированием `/ws` (mod_proxy_wstunnel) печатается в панели.

## Параметры server/.env (рейты и лимиты)
| Ключ | Значение по умолчанию | Назначение |
|---|---|---|
| PORT | 3000 | HTTP API + статика клиента + WS на одном порту |
| WS_PATH | /ws | путь WebSocket |
| DB_HOST/PORT/USER/PASS/NAME | 127.0.0.1:3306 root/∅ nvr_game | доступ к MySQL (XAMPP-профиль) |
| DB_AUTOINIT | 1 | сервер сам применяет schema.sql при старте |
| NO_DB | 0 | 1 = работать без MySQL (в памяти, для теста) |
| TICK_MS | 50 | частота игрового тика сервера |
| MOVE_RATE_HZ | 15 | макс. пакетов движения на соединение (TokenBucket) |
| CHAT_RATE_PER_S | 2 | сообщений чата в секунду (сверх — уведомление) |
| MAX_PLAYERS_WS | 200 | потолок одновременных игроков, переполнение → close 1013 |
| HEARTBEAT_MS | 30000 | интервал ws.ping() |
| IDLE_TIMEOUT_MS | 90000 | разрыв молчащего соединения |
| SAVE_EVERY_S | 30 | период автосохранения персонажа в БД |
| PUBLIC_MODE | 0 | 1 = слушать 0.0.0.0 (публичный доступ) |
| PUBLIC_HOST | ∅ | внешний IP/домен для ссылок игрокам |
| ALLOW_REG | 1 | 0 = закрыть регистрацию (/api/register → 403) |
| LOG_LEVEL | info | debug/info/warn/error |
| TOKEN_SECRET | ∅→генерится | HMAC-секрет токенов API (стабилен между рестартами) |

## Linux/Apache или PHP built-in
```bash
php -S 0.0.0.0:8090 -t xampp        # панель без Apache
mysql ... < server/schema.sql       # либо кнопка «Развернуть базу»
node server/server.js               # запуск вручную
```

## Проверенный контур (Linux-копия стека, MariaDB 10.11 + PHP 8.2 + Node 20)
schema.sql → таблицы+миры ✔ · save_cfg → .env c TOKEN_SECRET ✔ · deploy_db идемпотентно ✔ ·
start/stop/ping через панель ✔ · WS hello/welcome + флуд-тест 60 move-пакетов (rate-limit держит) ✔ ·
register/login в MySQL ✔ · клиент отдаётся сервером на :3000 ✔.
