<?php
/* ============================================================
 *  НОЧЬ ВОЕННОГО РЕМЕСЛА — PHP-панель развертывания сервера (XAMPP)
 *
 *  Возможности:
 *   • Автопоиск корня игры и папки XAMPP, проверка окружения
 *     (PHP+mysqli, Node.js, MySQL/MariaDB)
 *   • Развертывание БД: server/schema.sql + сид 4 миров
 *   • Генерация server/.env со ВСЕМИ настройками: порты, БД,
 *     рейты WebSocket (tick, move/s, chat/s), лимиты, heartbeat,
 *     автосейв, публичный режим, регистрация, логи
 *   • Публичный доступ: правила брандмауэра (netsh/ufw), готовый
 *     Apache-vhost с проксированием /ws → игровой сервер
 *   • npm install, запуск/остановка игрового сервера, ping-статус
 *
 *  Установка в XAMPP: скопируйте файл в C:\xampp\htdocs\nvr\deploy.php
 *  и откройте http://localhost/nvr/deploy.php
 * ============================================================ */
declare(strict_types=1);
session_start();
error_reporting(E_ALL); ini_set('display_errors', '1');

const VERSION = '1.0.0-alpha';

// mb_* не обязателен (в XAMPP включён, но подстрахуемся)
if (!function_exists('mb_substr')) {
    function mb_substr(string $s, int $start, ?int $len = null): string {
        if ($len === null) return substr($s, $start);
        return substr($s, $start, $len);
    }
}

function e(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function flash(string $m, string $t = 'ok'): void { $_SESSION['fl'][] = ['m' => $m, 't' => $t]; }
function take_flash(): array { $f = $_SESSION['fl'] ?? []; unset($_SESSION['fl']); return $f; }
function is_win(): bool { return strtoupper(substr(PHP_OS, 0, 3)) === 'WIN'; }

function detect_project_root(): string {
    $c = [];
    if (!empty($_GET['root']))  $c[] = rtrim((string)$_GET['root'], '\\/');
    if (!empty($_POST['root'])) $c[] = rtrim((string)$_POST['root'], '\\/');
    $d = $_SERVER['DOCUMENT_ROOT'] ?? '';
    if ($d) {
        $c[] = dirname($d) . DIRECTORY_SEPARATOR . 'nvr-game';   // рядом с htdocs
        $c[] = dirname(dirname($d));                              // на уровень выше webroot
        $c[] = $d . DIRECTORY_SEPARATOR . 'night-of-war-craft';
    }
    $c[] = dirname(__DIR__);           // если панель лежит в /xampp проекта
    $c[] = dirname(__DIR__, 2);
    $c[] = '/workspace';
    foreach ($c as $p) if ($p && is_dir($p) && @is_file($p . '/index.html') && is_dir($p . '/server')) return realpath($p) ?: $p;
    return '';
}

function detect_xampp_dir(): string {
    $c = [];
    $d = $_SERVER['DOCUMENT_ROOT'] ?? '';
    if ($d) $c[] = dirname($d);                          // C:\xampp\htdocs -> C:\xampp
    $c = array_merge($c, ['C:\\xampp', 'D:\\xampp', 'C:\\Program Files\\xampp', '/opt/lampp', '/Applications/XAMPP/xamppfiles']);
    foreach ($c as $p) if ($p && is_dir($p) && (is_dir($p . '/mysql') || is_dir($p . '/apache'))) return $p;
    foreach ($c as $p) if ($p && is_dir($p)) return $p;
    return '';
}

function find_exe(string $name, string $xamppDir): ?string {
    $ext = is_win() ? '.exe' : '';
    $tries = [];
    if ($xamppDir) {
        $tries[] = $xamppDir . "/mysql/bin/$name$ext";
        $tries[] = $xamppDir . "/php/$name$ext";
        $tries[] = $xamppDir . "/node/$name$ext";
    }
    $sep = is_win() ? ';' : ':';
    foreach (explode($sep, (string)getenv('PATH')) as $dir) {
        if ($dir !== '' && is_file(rtrim($dir, '\\/') . "/$name$ext")) return rtrim($dir, '\\/') . "/$name$ext";
    }
    foreach ($tries as $t) if (is_file($t)) return $t;
    return null;
}

function run_cmd(string $cmd, int $to = 60): array {
    $p = proc_open($cmd, [1 => ['pipe','w'], 2 => ['pipe','w']], $pipes);
    if (!is_resource($p)) return ['code' => -1, 'out' => '', 'err' => 'proc_open failed'];
    $out = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $err = stream_get_contents($pipes[2]); fclose($pipes[2]);
    return ['code' => proc_close($p), 'out' => trim((string)$out), 'err' => trim((string)$err)];
}

/* ---------------- конфигурация сервера ---------------- */
function default_config(): array {
    return [
        'PORT' => '3000', 'WS_PATH' => '/ws',
        'DB_HOST' => '127.0.0.1', 'DB_PORT' => '3306', 'DB_USER' => 'root', 'DB_PASS' => '',
        'DB_NAME' => 'nvr_game', 'DB_AUTOINIT' => '1', 'NO_DB' => '0',
        'TICK_MS' => '50', 'MOVE_RATE_HZ' => '15', 'CHAT_RATE_PER_S' => '2',
        'MAX_PLAYERS_WS' => '200', 'HEARTBEAT_MS' => '30000', 'IDLE_TIMEOUT_MS' => '90000',
        'SAVE_EVERY_S' => '30', 'PUBLIC_MODE' => '0', 'PUBLIC_HOST' => '',
        'ALLOW_REG' => '1', 'LOG_LEVEL' => 'info', 'TOKEN_SECRET' => '',
        // --- два ГМ-аккаунта (создаются автоматически при развертывании) ---
        'GM_EMAIL'   => 'gm1@nightforge.local',  'GM_PASS'  => 'Gm!NightCraft1', 'GM_NICK'  => 'Хранитель Зари',
        'GM2_EMAIL'  => 'gm2@nightforge.local',  'GM2_PASS' => 'Gm!NightCraft2', 'GM2_NICK' => 'Пепельный Вестник',
    ];
}
const GM_TABLE = [
    ['Кто',        'Уровень', 'Полномочия'],
    ['Владелец сервера',      '9', 'все команды, включая add_gm/del_gm и shutdown'],
    ['Старший ГМ (GM2)',      '3', 'бан/анбан, опыт игрокам, сообщения в мир, + всё из уровня 2'],
    ['ГМ',                    '2', 'телепорт, кик, мьют, поиск персонажей, + уровень 1'],
    ['Модератор (ур.1)',      '1', 'объявления, who/online, поиск — без наказаний'],
];
function load_config(string $root): array {
    $cfg = default_config();
    $f = $root . '/server/.env';
    if (is_file($f)) foreach (file($f, FILE_IGNORE_NEW_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        if (array_key_exists(trim($k), $cfg)) $cfg[trim($k)] = trim($v);
    }
    return $cfg;
}
function save_env(string $root, array $cfg): string {
    if ($cfg['TOKEN_SECRET'] === '') $cfg['TOKEN_SECRET'] = bin2hex(random_bytes(24)); // стабильный секрет токенов
    $L = ["# ============================================================",
          "#  НОЧЬ ВОЕННОГО РЕМЕСЛА — конфигурация сервера",
          "#  Сгенерировано deploy.php " . date('Y-m-d H:i:s'),
          "# ============================================================"];
    foreach ($cfg as $k => $v) $L[] = "$k=$v";
    @mkdir("$root/server", 0777, true);
    file_put_contents("$root/server/.env", implode("\n", $L) . "\n");
    return "$root/server/.env";
}

/* ---------------- проверки ---------------- */
$ROOT  = detect_project_root();
$XAMPP = detect_xampp_dir();
$NODE  = find_exe('node', $XAMPP);
$NPM   = find_exe('npm', $XAMPP);
$CFG   = $ROOT ? load_config($ROOT) : default_config();
$ERROR = null;

function mysql_link(array $cfg) {
    return @mysqli_connect($cfg['DB_HOST'], $cfg['DB_USER'], $cfg['DB_PASS'], '', (int)$cfg['DB_PORT']);
}
// Наполнение справочников (tools/seed_db.php из server/content_export.json) + счётчики таблиц для визуализации
function seed_reference_data(string $root, array $cfg): array {
    $seed = "$root/tools/seed_db.php";
    if (!is_file($seed)) return ['ok' => false, 'error' => 'Не найден tools/seed_db.php'];
    if (!is_file("$root/server/content_export.json")) return ['ok' => false, 'error' => 'Не найден server/content_export.json (выгрузите контент: node tools/export_content.mjs)'];
    $php = PHP_BINARY ?: 'php';
    $cmd = sprintf('%s %s %s %d %s %s %s 2>&1', escapeshellarg($php), escapeshellarg($seed),
        escapeshellarg($cfg['DB_HOST']), (int)$cfg['DB_PORT'], escapeshellarg($cfg['DB_USER']),
        escapeshellarg($cfg['DB_PASS']), escapeshellarg($cfg['DB_NAME']));
    $out = []; $code = 0; exec($cmd, $out, $code);
    $txt = implode("\n", $out);
    if ($code !== 0 || strpos($txt, 'SEED OK') === false) return ['ok' => false, 'error' => mb_substr($txt, 0, 400)];
    // визуализация счётчиков прямо из БД
    $link = mysql_link($cfg);
    $summary = trim($txt);
    if ($link && @mysqli_select_db($link, $cfg['DB_NAME'])) {
        mysqli_set_charset($link, 'utf8mb4');
        $cnt = [];
        foreach (['factions','classes','locations','mobs','items','npcs','recipes','abilities','quests','instances'] as $t) {
            $r = @mysqli_fetch_row(@mysqli_query($link, "SELECT COUNT(*) FROM `$t`"));
            if ($r) $cnt[] = "$t=" . (int)$r[0];
        }
        mysqli_close($link);
        if ($cnt) $summary = implode(' · ', $cnt);
    }
    return ['ok' => true, 'summary' => $summary];
}
function server_ping(array $cfg): array {
    $url = sprintf('http://127.0.0.1:%d/api/ping', (int)$cfg['PORT']);
    $ctx = stream_context_create(['http' => ['timeout' => 3]]);
    $b = @file_get_contents($url, false, $ctx);
    return ['ok' => $b !== false, 'url' => $url, 'body' => (string)$b];
}

/* ---------------- действия ---------------- */
// Создание двух ГМ-аккаунтов (пароли — SHA-256(salt:pass), как в ядре сервера)
function create_gm_accounts(mysqli $link, array $cfg): string {
    @mysqli_query($link, "CREATE TABLE IF NOT EXISTS gm_accounts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        account_id INT UNSIGNED NOT NULL UNIQUE,
        gm_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
        perms TEXT NULL, note VARCHAR(120) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    @mysqli_query($link, "CREATE TABLE IF NOT EXISTS audit_log (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        gm_email VARCHAR(190) NOT NULL, command VARCHAR(48) NOT NULL,
        args VARCHAR(500) NOT NULL DEFAULT '', result VARCHAR(255) NOT NULL DEFAULT '',
        ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_ts(ts))");
    @mysqli_query($link, "CREATE TABLE IF NOT EXISTS bans (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL UNIQUE, reason VARCHAR(200) NOT NULL DEFAULT '',
        expires_at TIMESTAMP NULL, banned_by VARCHAR(190) NOT NULL DEFAULT 'deploy',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    $list = [
        ['email' => $cfg['GM_EMAIL'],  'pass' => $cfg['GM_PASS'],  'nick' => $cfg['GM_NICK'],  'level' => 9],
        ['email' => $cfg['GM2_EMAIL'], 'pass' => $cfg['GM2_PASS'], 'nick' => $cfg['GM2_NICK'], 'level' => 3],
    ];
    $out = [];
    foreach ($list as $gm) {
        $email = strtolower(trim($gm['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $out[] = "Пропущен некорректный e-mail: '$email'"; continue; }
        $res = @mysqli_query($link, "SELECT id FROM accounts WHERE email='" . mysqli_real_escape_string($link, $email) . "' LIMIT 1");
        $accId = null;
        if ($res && $row = mysqli_fetch_assoc($res)) $accId = (int)$row['id'];
        if (!$accId) {
            $salt = bin2hex(random_bytes(8));
            $hash = hash('sha256', $salt . ':' . $gm['pass']);
            $st = mysqli_prepare($link, 'INSERT INTO accounts (email, nick, pass_hash, salt) VALUES (?,?,?,?)');
            if (!$st) { $out[] = "Не удалось создать аккаунт $email: " . mysqli_error($link); continue; }
            $nick = $gm['nick'] ?: 'ГМ';
            mysqli_stmt_bind_param($st, 'ssss', $email, $nick, $hash, $salt);
            if (!mysqli_stmt_execute($st)) { $out[] = "Ошибка вставки $email: " . mysqli_stmt_error($st); mysqli_stmt_close($st); continue; }
            $accId = mysqli_insert_id($link);
            mysqli_stmt_close($st);
        }
        $perms = json_encode(['level' => $gm['level']], JSON_UNESCAPED_UNICODE);
        $st2 = mysqli_prepare($link, 'INSERT INTO gm_accounts (account_id, gm_level, perms, note) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE gm_level=VALUES(gm_level), perms=VALUES(perms)');
        mysqli_stmt_bind_param($st2, 'isss', $accId, $gm['level'], $perms, 'deploy.php');
        mysqli_stmt_execute($st2); mysqli_stmt_close($st2);
        $title = $gm['level'] >= 9 ? 'Владелец сервера' : 'Старший ГМ';
        $out[] = "★ {$email} · ник «{$gm['nick']}» · пароль {$gm['pass']} → $title (ур.${gm['level']})";
    }
    return implode("\n", $out);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['act'])) {
    $act = (string)$_POST['act'];
    try {
        if ($act === 'setroot') {
            $r = rtrim(trim((string)($_POST['root'] ?? '')), '\\/');
            if (!$r || !is_dir($r) || !is_file($r . '/index.html')) throw new Exception('Указан несуществующий путь к игре.');
            header('Location: deploy.php?root=' . urlencode($r)); exit;
        }
        if (!$ROOT) throw new Exception('Сначала укажите корректный корень проекта (§1).');

        switch ($act) {
            case 'save_cfg': {
                foreach ($CFG as $k => $v) if (isset($_POST[$k])) $CFG[$k] = trim((string)$_POST[$k]);
                $num = fn($k, $lo, $hi) => $CFG[$k] = (string)max($lo, min($hi, (int)$CFG[$k]));
                $num('PORT', 1024, 65535); $num('DB_PORT', 1, 65535); $num('TICK_MS', 16, 1000);
                $num('MOVE_RATE_HZ', 1, 60); $num('CHAT_RATE_PER_S', 0, 20); $num('MAX_PLAYERS_WS', 1, 5000);
                $num('HEARTBEAT_MS', 5000, 300000); $num('IDLE_TIMEOUT_MS', 10000, 600000); $num('SAVE_EVERY_S', 5, 600);
                $CFG['PUBLIC_MODE'] = $CFG['PUBLIC_MODE'] === '1' ? '1' : '0';
                $CFG['ALLOW_REG']   = $CFG['ALLOW_REG']   === '1' ? '1' : '0';
                $CFG['NO_DB']       = $CFG['NO_DB']       === '1' ? '1' : '0';
                $CFG['DB_AUTOINIT'] = $CFG['DB_AUTOINIT'] === '1' ? '1' : '0';
                flash('Конфигурация сохранена в ' . save_env($ROOT, $CFG) . '. Перезапустите игровой сервер, чтобы применить рейты.');
                break;
            }
            case 'deploy_db': {
                $schema = "$ROOT/server/schema.sql";
                if (!is_file($schema)) throw new Exception('Не найден server/schema.sql');
                $link = mysql_link($CFG);
                if (!$link) throw new Exception('MySQL не отвечает (' . $CFG['DB_HOST'] . ':' . $CFG['DB_PORT'] . '). Запустите MySQL в панели XAMPP.');
                mysqli_set_charset($link, 'utf8mb4');
                if (!@mysqli_multi_query($link, (string)file_get_contents($schema))) {
                    $er = mysqli_error($link); mysqli_close($link); throw new Exception('Ошибка применения схемы: ' . $er);
                }
                while (@mysqli_more_results($link) && @mysqli_next_result($link)) {}
                @mysqli_query($link, "USE `{$CFG['DB_NAME']}`");
                $worlds = [['nwm-1','Первый Костёр',20261102,'высокая'],['nwm-2','Люминитовый Разлом',770211,'средняя'],
                           ['nwm-3','Пепел Аэрии',411007,'низкая'],['nwm-4','Сумеречная Роща',902113,'высокая']];
                $st = mysqli_prepare($link, 'INSERT INTO worlds(id,name,seed,pop) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),seed=VALUES(seed),pop=VALUES(pop)');
                if (!$st) { $er = mysqli_error($link); mysqli_close($link); throw new Exception("Таблицы не созданы: $er"); }
                foreach ($worlds as $w) { mysqli_stmt_bind_param($st, 'ssis', $w[0], $w[1], $w[2], $w[3]); mysqli_stmt_execute($st); }
                mysqli_stmt_close($st);
                $gmMsg = create_gm_accounts($link, $CFG);           // ← два ГМ-аккаунта + gm_accounts
                mysqli_close($link);
                flash("БД «{$CFG['DB_NAME']}» развернута: accounts/worlds/characters/chat_log/gm_accounts/audit_log/bans + 4 мира засеяны." . ($gmMsg ? "\n" . $gmMsg : ''));
                // автонаполнение справочников сразу после развертывания
                $seedRes = seed_reference_data($ROOT, $CFG);
                if ($seedRes['ok']) flash('Справочники наполнены автоматически → ' . $seedRes['summary'], 'ok');
                else flash('Развертывание БД выполнено, но наполнение справочников не удалось: ' . $seedRes['error'] . '. Нажмите «Наполнить справочники».', 'warn');
                break;
            }
            case 'seed_db': {                                        // «Наполнить справочники» (ручной запуск/повтор)
                $link = mysql_link($CFG);
                if (!$link) throw new Exception('MySQL не отвечает — запустите его в XAMPP.');
                if (!@mysqli_select_db($link, $CFG['DB_NAME'])) { mysqli_close($link); throw new Exception('БД не найдена — сначала разверните базу.'); }
                mysqli_close($link);
                $seedRes = seed_reference_data($ROOT, $CFG);
                if (!$seedRes['ok']) throw new Exception($seedRes['error']);
                flash('Наполнение справочников завершено → ' . $seedRes['summary']);
                break;
            }
            case 'create_gm': {                                       // повторное выполнение без пересоздания БД
                $link = mysql_link($CFG);
                if (!$link) throw new Exception('MySQL не отвечает — запустите его в XAMPP.');
                mysqli_set_charset($link, 'utf8mb4');
                if (!@mysqli_select_db($link, $CFG['DB_NAME'])) { mysqli_close($link); throw new Exception('БД не найдена — сначала разверните базу.'); }
                @mysqli_query($link, (string)file_get_contents("$ROOT/server/schema.sql"));   // догоняем новые таблицы (IF NOT EXISTS)
                while (@mysqli_more_results($link) && @mysqli_next_result($link)) {}
                @mysqli_query($link, "USE `{$CFG['DB_NAME']}`");
                $gmMsg = create_gm_accounts($link, $CFG);
                mysqli_close($link);
                flash($gmMsg ?: 'ГМ уже существуют.');
                break;
            }
            case 'npm': {
                if (!$NODE) throw new Exception('Node.js не найден. Установите LTS: https://nodejs.org (при установке отметьте «Add to PATH»).');
                $npm = $NPM ?? 'npm';
                $r = run_cmd(sprintf('cd %s && %s install --no-audit --no-fund 2>&1', escapeshellarg("$ROOT/server"), escapeshellarg($npm)), 600);
                if ($r['code'] !== 0) throw new Exception('npm install: ' . mb_substr($r['out'] . $r['err'], 0, 600));
                flash('Зависимости сервера установлены (express, ws, mysql2).');
                break;
            }
            case 'start': {
                if (!$NODE) throw new Exception('Node.js не найден.');
                if (server_ping($CFG)['ok']) { flash('Сервер уже запущен на порту ' . $CFG['PORT'], 'warn'); break; }
                $js = realpath("$ROOT/server/server.js") ?: "$ROOT/server/server.js";
                if (is_win()) {
                    $ps = sprintf('Start-Process -WindowStyle Hidden -FilePath %s -ArgumentList %s -WorkingDirectory %s',
                        escapeshellarg($NODE), escapeshellarg($js), escapeshellarg("$ROOT/server"));
                    pclose(popen('powershell -NoProfile -Command "' . str_replace('"', '\\"', $ps) . '" >nul 2>&1', 'r'));
                } else {
                    exec(sprintf('nohup %s %s >> %s 2>&1 & echo started', escapeshellarg($NODE), escapeshellarg($js), escapeshellarg("$ROOT/server/game-server.log")));
                }
                sleep(2);
                $p = server_ping($CFG);
                flash($p['ok'] ? "Игровой сервер запущен · порт {$CFG['PORT']} · /api/ping OK."
                               : "Сервер стартовал, но пинг пока не проходит — смотрите server/game-server.log.", $p['ok'] ? 'ok' : 'warn');
                break;
            }
            case 'stop': {
                if (is_win()) run_cmd('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object CommandLine -like \'*server.js*\' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"');
                else run_cmd('pkill -f "node .*server/server.js" ; true');
                flash('Процессы node server.js остановлены.');
                break;
            }
        }
    } catch (Throwable $ex) { $ERROR = $ex->getMessage(); }
    header('Location: deploy.php' . ($ROOT ? '?root=' . urlencode($ROOT) : '')); exit;
}

$PING   = $ROOT ? server_ping($CFG) : ['ok' => false, 'url' => '—', 'body' => ''];
$PHP_OK = extension_loaded('mysqli');
$MLINK  = mysql_link($CFG);
$MVER   = $MLINK ? mysqli_get_server_info($MLINK) : null;
if ($MLINK) mysqli_close($MLINK);
$WORLDS = [];
if ($MLINK === null && !$MVER) { /* no db */ }
if ($MVER) {
    $m = mysql_link($CFG);
    if ($m && @mysqli_select_db($m, $CFG['DB_NAME'])) {
        mysqli_set_charset($m, 'utf8mb4');
        $res = @mysqli_query($m, 'SELECT w.id,w.name,w.pop,(SELECT COUNT(*) FROM characters c WHERE c.world_id=w.id) AS chars FROM worlds w ORDER BY w.id');
        if ($res) while ($row = mysqli_fetch_assoc($res)) $WORLDS[] = $row;
    }
    if ($m) mysqli_close($m);
}
$HOSTIP = $_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname());
?>
<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ночь Военного Ремесла — развертывание сервера</title>
<style>
:root{--bg:#0a0d14;--panel:#121a2a;--gold:#d9b45b;--txt:#dfe6f2;--mut:#8b97ad;--ok:#4cc38a;--err:#e0655f;--warn:#e0a45f;--line:#22304a}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1100px 500px at 75% -10%,#1a2440,#0a0d14 60%);color:var(--txt);font:14px/1.55 "Segoe UI",Roboto,Arial,sans-serif;padding:22px}
h1{font-family:Georgia,serif;color:var(--gold);letter-spacing:.05em;margin:0;font-size:24px;text-shadow:0 0 22px rgba(217,180,91,.3)}
.sub{color:var(--mut);margin:4px 0 20px}.wrap{max-width:1180px;margin:0 auto}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:980px){.grid{grid-template-columns:1fr}}
.card{background:linear-gradient(180deg,var(--panel),#0d1320);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:16px;box-shadow:0 8px 26px rgba(0,0,0,.4)}
.card h2{margin:0 0 12px;font:600 13px/1.4 Georgia,serif;color:var(--gold);text-transform:uppercase;letter-spacing:.14em;border-bottom:1px solid var(--line);padding-bottom:8px}
.row{display:flex;align-items:center;gap:10px;margin:7px 0;flex-wrap:wrap}
.dot{width:10px;height:10px;border-radius:50%;flex:none}.dot.ok{background:var(--ok);box-shadow:0 0 8px var(--ok)}.dot.err{background:var(--err);box-shadow:0 0 8px var(--err)}.dot.warn{background:var(--warn)}
label{color:var(--mut);min-width:230px;display:inline-block;font-size:13px}
input[type=text],input[type=password],input[type=number],select{background:#0a1120;border:1px solid var(--line);color:var(--txt);border-radius:6px;padding:7px 10px;width:230px;font-size:13px}
input:focus,select:focus{outline:none;border-color:#8a6d2f}
button{background:linear-gradient(180deg,#caa64f,#9a7a2e);color:#141008;border:0;border-radius:6px;padding:9px 15px;font-weight:700;cursor:pointer;font-size:13px}
button:hover{filter:brightness(1.12)}button.gray{background:linear-gradient(180deg,#3a465e,#28324a);color:#dbe3f2}button.red{background:linear-gradient(180deg,#c0564f,#8f3a35);color:#fff}
pre{background:#060a12;border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto;font-size:12px;color:#bcd;margin:8px 0}
.flash{border-left:4px solid var(--ok);background:rgba(76,195,138,.08);padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px}
.flash.warn{border-color:var(--warn);background:rgba(224,164,95,.08)}.flash.err{border-color:var(--err);background:rgba(224,101,95,.08)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left}th{color:var(--gold);font-weight:600}
.small{font-size:12px;color:var(--mut)}code{color:var(--gold)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 24px}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
</style></head><body><div class="wrap">
<h1>⚒ Ночь Военного Ремесла — развертывание сервера</h1>
<div class="sub">PHP-панель v<?=VERSION?> для XAMPP · связка <b>Apache/PHP + Node.js + MySQL(MariaDB)</b> · Эфирия, Долгая Ночь</div>

<?php foreach (take_flash() as $f): ?><div class="flash <?=e($f['t'])?>"><?=nl2br(e($f['m']))?></div><?php endforeach; ?>
<?php if ($ERROR): ?><div class="flash err"><b>Ошибка:</b> <?=nl2br(e($ERROR))?></div><?php endif; ?>

<div class="grid"><div><!-- ЛЕВАЯ КОЛОНКА -->

<div class="card"><h2>1. Окружение и пути</h2>
<div class="row"><span class="dot <?= $PHP_OK ? 'ok' : 'err' ?>"></span> PHP <?=PHP_VERSION?> · mysqli <?= $PHP_OK ? '✓' : '✗ (включите в php.ini)' ?></div>
<div class="row"><span class="dot <?= $NODE ? 'ok' : 'err' ?>"></span> Node.js: <?php if ($NODE) { $nv = @shell_exec(escapeshellarg($NODE) . ' --version 2>/dev/null'); echo '<code>' . e(trim((string)$nv)) . '</code> · ' . e($NODE); } else echo 'не найден — установите <a style="color:#d9b45b" href="https://nodejs.org" target="_blank">Node LTS</a>'; ?></div>
<div class="row"><span class="dot <?= $MVER ? 'ok' : 'err' ?>"></span> MySQL/MariaDB (<?= (int)$CFG['DB_PORT'] ?>): <?= e($MVER ?: 'нет соединения — запустите MySQL в панели XAMPP') ?></div>
<div class="row"><span class="dot <?= $ROOT ? 'ok' : 'err' ?>"></span> Корень игры: <code><?= e($ROOT ?: 'не найден') ?></code></div>
<form method="post" class="row" style="margin-top:8px">
<input type="hidden" name="act" value="setroot">
<label>Путь вручную:</label><input type="text" name="root" size="42" placeholder="C:\xampp\htdocs\nvr-game или /var/www/nvr" value="<?=e($_POST['root'] ?? '')?>">
<button>Применить</button></form>
<p class="small">XAMPP-профиль: файлы игры → <code>C:\xampp\htdocs\nvr-game</code>, этот скрипт → <code>C:\xampp\htdocs\nvr-deploy\deploy.php</code>. Панель сама найдёт игру по соседству.</p>
</div>

<div class="card"><h2>2. База данных (MySQL из XAMPP)</h2>
<form method="post"><input type="hidden" name="act" value="save_cfg">
<div class="cols">
<div class="row"><label>Хост</label><input type="text" name="DB_HOST" value="<?=e($CFG['DB_HOST'])?>"></div>
<div class="row"><label>Порт</label><input type="number" name="DB_PORT" value="<?=e($CFG['DB_PORT'])?>"></div>
<div class="row"><label>Пользователь</label><input type="text" name="DB_USER" value="<?=e($CFG['DB_USER'])?>"></div>
<div class="row"><label>Пароль (XAMPP: пусто)</label><input type="password" name="DB_PASS" value="<?=e($CFG['DB_PASS'])?>"></div>
<div class="row"><label>Имя БД</label><input type="text" name="DB_NAME" value="<?=e($CFG['DB_NAME'])?>"></div>
<div class="row"><label>Авто-схема при старте</label><select name="DB_AUTOINIT"><option value="1" <?=$CFG['DB_AUTOINIT']==='1'?'selected':''?>>вкл</option><option value="0" <?=$CFG['DB_AUTOINIT']==='0'?'selected':''?>>выкл</option></select></div>
</div>
<div class="btns"><button>💾 Сохранить конфиг</button>
<button name="act" value="deploy_db">▶ Развернуть базу (schema.sql + миры)</button></div></form>
<form method="post" class="btns" style="margin-top:6px"><input type="hidden" name="act" value="seed_db">
<button name="act" value="seed_db">📚 Наполнить справочники (локации, мобы, <?= e((string)@(json_decode(@file_get_contents("$ROOT/server/content_export.json") ?: '{}', true)['allQuests'] ?? [] ? count(json_decode(@file_get_contents("$ROOT/server/content_export.json") ?: '{}', true)['allQuests'] ?? []) : 0)) ?> квестов, инстансы)</button></form>
<?php if ($MVER && $ROOT): $refCnt = []; foreach (['factions'=>'Фракции','classes'=>'Классы','locations'=>'Локации','mobs'=>'Мобы','items'=>'Предметы','npcs'=>'NPC','quests'=>'Квесты','instances'=>'Инстансы'] as $rt => $rlabel) { $rr = @mysqli_fetch_row(@mysqli_query($MLINK, "SELECT COUNT(*) FROM `$rt`")); $refCnt[$rlabel] = $rr ? (int)$rr[0] : '—'; } ?>
<table style="margin-top:12px"><tr><th colspan="<?= count($refCnt) ?>">Справочники игры (наполнение из content_export.json)</th></tr>
<tr><?php foreach ($refCnt as $k => $v): ?><td align="center"><b><?= e((string)$v) ?></b><br><span class="small"><?= e($k) ?></span></td><?php endforeach; ?></tr></table>
<?php endif; ?>
<?php if ($WORLDS): ?><table style="margin-top:12px"><tr><th>Мир</th><th>ID</th><th>Популяция</th><th>Персонажей</th></tr>
<?php foreach ($WORLDS as $w): ?><tr><td><?=e($w['name'])?></td><td><code><?=e($w['id'])?></code></td><td><?=e($w['pop'])?></td><td><?=e((string)$w['chars'])?></td></tr><?php endforeach; ?></table>
<?php elseif ($MVER && $ROOT): ?><p class="small">БД ещё не развернута — нажмите «Развернуть базу».</p><?php endif; ?>
</div>

<div class="card"><h2>3. Настройки сервера · рейты · лимиты</h2>
<form method="post"><input type="hidden" name="act" value="save_cfg">
<div class="cols">
<div class="row"><label>Порт HTTP/WS (PORT)</label><input type="number" name="PORT" value="<?=e($CFG['PORT'])?>"></div>
<div class="row"><label>Путь WebSocket (WS_PATH)</label><input type="text" name="WS_PATH" value="<?=e($CFG['WS_PATH'])?>"></div>
<div class="row"><label>Игровой тик, мс (TICK_MS)</label><input type="number" name="TICK_MS" value="<?=e($CFG['TICK_MS'])?>"></div>
<div class="row"><label>Движение: пакетов/сек (MOVE_RATE_HZ)</label><input type="number" name="MOVE_RATE_HZ" value="<?=e($CFG['MOVE_RATE_HZ'])?>"></div>
<div class="row"><label>Чат: сообщений/сек (CHAT_RATE_PER_S)</label><input type="number" name="CHAT_RATE_PER_S" value="<?=e($CFG['CHAT_RATE_PER_S'])?>"></div>
<div class="row"><label>Макс. игроков онлайн (MAX_PLAYERS_WS)</label><input type="number" name="MAX_PLAYERS_WS" value="<?=e($CFG['MAX_PLAYERS_WS'])?>"></div>
<div class="row"><label>Heartbeat, мс (HEARTBEAT_MS)</label><input type="number" name="HEARTBEAT_MS" value="<?=e($CFG['HEARTBEAT_MS'])?>"></div>
<div class="row"><label>Idle-разрыв, мс (IDLE_TIMEOUT_MS)</label><input type="number" name="IDLE_TIMEOUT_MS" value="<?=e($CFG['IDLE_TIMEOUT_MS'])?>"></div>
<div class="row"><label>Автосохранение в БД, сек (SAVE_EVERY_S)</label><input type="number" name="SAVE_EVERY_S" value="<?=e($CFG['SAVE_EVERY_S'])?>"></div>
<div class="row"><label>Регистрация с клиента</label><select name="ALLOW_REG"><option value="1" <?=$CFG['ALLOW_REG']==='1'?'selected':''?>>открыта</option><option value="0" <?=$CFG['ALLOW_REG']==='0'?'selected':''?>>закрыта</option></select></div>
<div class="row"><label>Хранилище</label><select name="NO_DB"><option value="0" <?=$CFG['NO_DB']==='0'?'selected':''?>>MySQL</option><option value="1" <?=$CFG['NO_DB']==='1'?'selected':''?>>память (тест без БД)</option></select></div>
<div class="row"><label>Уровень логов (LOG_LEVEL)</label><select name="LOG_LEVEL"><?php foreach(['debug','info','warn','error'] as $l): ?><option <?=$CFG['LOG_LEVEL']===$l?'selected':''?>><?=$l?></option><?php endforeach; ?></select></div>
<div class="row"><label>Секрет токенов (TOKEN_SECRET)</label><input type="text" name="TOKEN_SECRET" value="<?=e($CFG['TOKEN_SECRET'])?>" placeholder="пусто = сгенерировать"></div>
</div>
<div class="btns"><button>💾 Сохранить server/.env</button></div>
<p class="small">Рейты применяются при старте сервера — после изменений перезапустите (§4). Анти-флуд: лишние пакеты движения отбрасываются, чат получает уведомление.</p>
</div>

</div><div><!-- ПРАВАЯ КОЛОНКА -->

<div class="card"><h2>4. Игровой сервер</h2>
<div class="row"><span class="dot <?=$PING['ok']?'ok':'err'?>"></span> <?=e($PING['url'])?>: <b><?= $PING['ok'] ? 'ONLINE' : 'offline' ?></b>
<?php if ($PING['ok'] && $PING['body']): ?><span class="small">· <?=e(mb_substr($PING['body'], 0, 100))?></span><?php endif; ?></div>
<div class="btns">
<form method="post" style="display:inline"><button name="act" value="npm" class="gray">📦 npm install</button></form>
<form method="post" style="display:inline"><button name="act" value="start">▶ Запустить</button></form>
<form method="post" style="display:inline"><button name="act" value="stop" class="red">■ Остановить</button></form>
</div>
<p class="small">Лог: <code><?=e($ROOT)?>/server/game-server.log</code> · автозапуск через планировщик Windows: <code>schtasks /create /tn NVR /tr "\"<?=e($NODE ?: 'node')?>" \"<?=e($ROOT)?>\server\server.js\"" /sc onstart</code></p>
</div>

<div class="card"><h2>5. Публичный доступ (LAN/интернет)</h2>
<form method="post"><input type="hidden" name="act" value="save_cfg">
<div class="row"><label>Публичный режим (bind 0.0.0.0)</label><select name="PUBLIC_MODE"><option value="0" <?=$CFG['PUBLIC_MODE']==='0'?'selected':''?>>нет — только localhost</option><option value="1" <?=$CFG['PUBLIC_MODE']==='1'?'selected':''?>>да — все интерфейсы</option></select></div>
<div class="row"><label>Внешний адрес (PUBLIC_HOST)</label><input type="text" name="PUBLIC_HOST" value="<?=e($CFG['PUBLIC_HOST'])?>" placeholder="<?=e($HOSTIP ?: 'ip или домен')?>"></div>
<div class="btns"><button>Сохранить</button></div></form>
<p class="small">IP хоста: <code><?=e($HOSTIP ?: '—')?></code>. Ссылка для игроков:<br>
<code>http://<?=e($CFG['PUBLIC_HOST'] ?: ($HOSTIP ?: 'ВАШ_IP'))?>:<?=e($CFG['PORT'])?>/?api=http://<?=e($CFG['PUBLIC_HOST'] ?: 'ВАШ_IP')?>:<?=e($CFG['PORT'])?>&amp;server=ws://<?=e($CFG['PUBLIC_HOST'] ?: 'ВАШ_IP')?>:<?=e($CFG['PORT'])?><?=e($CFG['WS_PATH'])?></code></p>
<label class="small">Брандмауэр:</label>
<pre><?=e(is_win()
  ? "netsh advfirewall firewall add rule name=\"NVR Game\" dir=in action=allow protocol=TCP localport={$CFG['PORT']}\nnetsh advfirewall firewall add rule name=\"NVR HTTP\" dir=in action=allow protocol=TCP localport=80"
  : "sudo ufw allow {$CFG['PORT']}/tcp && sudo ufw allow 80/tcp")?></pre>
<label class="small">Apache vhost (:80 → игра + прокси /ws на порт <?=e($CFG['PORT'])?>) — в <code>conf/extra/httpd-vhosts.conf</code>:</label>
<pre><?=e("# Ночь Военного Ремесла — публичный фронт\nListen 80\n<VirtualHost *:80>\n    DocumentRoot \"".($ROOT ?: 'C:\\xampp\\htdocs\\nvr-game')."\"\n    ServerName nvr.local\n    <Directory \"".($ROOT ?: 'C:\\xampp\\htdocs\\nvr-game')."\">\n        Require all granted\n        Options -Indexes\n    </Directory>\n    # включите в httpd.conf: LoadModule proxy_module / proxy_http_module / proxy_wstunnel_module\n    ProxyPass {$CFG['WS_PATH']} ws://127.0.0.1:{$CFG['PORT']}{$CFG['WS_PATH']}\n    ProxyPassReverse {$CFG['WS_PATH']} ws://127.0.0.1:{$CFG['PORT']}{$CFG['WS_PATH']}\n    ProxyPassMatch ^/api/ http://127.0.0.1:{$CFG['PORT']}/api/\n</VirtualHost>")?></pre>
<p class="small">Для доступа из интернета: пробросьте порт <?=e($CFG['PORT'])?> (TCP) на роутере и/или используйте домен с DNS. Для HTTPS — mod_ssl + Let's Encrypt (wss://).</p>
</div>

<div class="card"><h2>6. Чек-лист запуска</h2>
<ol class="small" style="line-height:2">
<li>XAMPP Control Panel → запустить <b>Apache</b> и <b>MySQL</b>.</li>
<li>§1 указать корень игры (если не найден).</li>
<li>§2 «Сохранить конфиг» → «Развернуть базу».</li>
<li>§4 «npm install» (один раз) → «Запустить».</li>
<li>Играть: <code>http://localhost:<?=e($CFG['PORT'])?>/</code> — регистрация → мир → персонаж.</li>
<li>Публично: §5 PUBLIC_MODE=1 + брандмауэр + ссылка игрокам.</li>
</ol>
</div>

</div></div>
<p class="small" style="text-align:center;margin-top:18px">«Ночь Военного Ремесла» · deploy.php v<?=VERSION?> · свет — твоё оружие, тьма — твой враг</p>
</div></body></html>
