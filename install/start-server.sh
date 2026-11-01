#!/usr/bin/env bash
cd "$(dirname "$0")/.."
[ -f server/.env ] || cp server/.env.example server/.env
[ -d server/node_modules ] || (cd server && npm install --no-audit --no-fund)
exec node server/server.js
