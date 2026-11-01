#!/usr/bin/env bash
# Ночь Военного Ремесла — запуск альфы (из корня проекта!)
PORT="${1:-8080}"
echo "Игра: http://localhost:${PORT}/  (и http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}/ внутри сети окружения)"
python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$(dirname "$0")"
