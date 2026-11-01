<?php
// Наполнение справочников игры из server/content_export.json (для установщика XAMPP/deploy.php, без Node)
// php tools/seed_db.php [host] [port] [user] [pass] [dbname]
$host = $argv[1] ?? '127.0.0.1'; $port = (int)($argv[2] ?? 3306);
$user = $argv[3] ?? 'root';      $pass = $argv[4] ?? '';       $db   = $argv[5] ?? 'nvr_game';
$json = json_decode(file_get_contents(__DIR__ . '/../server/content_export.json'), true);
if (!$json) { fwrite(STDERR, "content_export.json не найден или битый — сначала: node tools/export_content.mjs\n"); exit(1); }
$m = @mysqli_connect($host, $user, $pass, '', $port) or exit("MySQL недоступен: " . mysqli_connect_error() . "\n");
@mysqli_query($m, "SET NAMES utf8mb4");
mysqli_select_db($m, $db) or exit("БД $db не найдена — разверните схему.\n");
$cut = function ($s, $n) { $s = (string)$s; if (function_exists('mb_strimwidth')) return mb_strimwidth($s, 0, $n, '', 'UTF-8');
  // без mbstring: безопасный по UTF-8 обрез по символам
  $out=''; $cnt=0; $len=strlen($s); $i=0;
  while ($i < $len && $cnt < $n) {
    $c = ord($s[$i]);
    if ($c < 0x80) { $w = 1; } elseif (($c & 0xE0) == 0xC0) { $w = 2; } elseif (($c & 0xF0) == 0xE0) { $w = 3; } else { $w = 4; }
    if ($i + $w > $len) break;
    $out .= substr($s, $i, $w); $i += $w; $cnt++;
  }
  return $out; };
$sc = fn($s) => "'" . mysqli_real_escape_string($m, (string)$s) . "'";
$run = function ($sql) use ($m) { if (!@mysqli_query($m, $sql)) echo "WARN: " . mysqli_error($m) . "\n"; };

foreach (($json['factions'] ?? []) as $id => $f)
  $run("INSERT INTO factions VALUES ('$id',".$sc($f['name']).",".$sc($cut($f['motto'].' '.$f['desc'],180)).",".$sc($f['color']).") ON DUPLICATE KEY UPDATE name=VALUES(name)");
foreach (($json['classes'] ?? []) as $id => $c)
  $run("INSERT INTO classes VALUES ('$id',".$sc($c['name']).",".$sc('forge').",".$sc($c['tag']).",".$sc('might').",".$sc($c['color']).",".$sc($cut($c['desc'],250)).") ON DUPLICATE KEY UPDATE name=VALUES(name)");
foreach (($json['locations'] ?? []) as $id => $l) {
  $mobs = implode(',', array_column(array_map(fn($s)=>[$s[0]], $l['spawns'] ?? []), 0));
  $run("INSERT INTO locations VALUES ('$id',".$sc($l['name']).",".(int)(($l['anchor'][0] ?? 0)*10).",".(int)(($l['anchor'][1] ?? 0)*10).",".(int)($l['radius'] ?? 45).",".$sc($l['biome'] ?? 'nightsite').",".$sc($cut($l['desc'],250)).",".$sc($mobs).",".$sc(implode(',', $l['npcs'] ?? [])).") ON DUPLICATE KEY UPDATE name=VALUES(name)");
}
foreach (($json['mobs'] ?? []) as $id => $b)
  $run("INSERT INTO mobs VALUES ('$id',".$sc($b['name']).",".(int)$b['level'].",".(int)$b['hp'].",".(int)($b['dmg'][0] ?? 1).",".(int)($b['dmg'][1] ?? 5).",".(int)$b['xp'].",".$sc($b['shape'] ?? 'beast').",".(int)!empty($b['boss']).",".$sc(json_encode($b['loot'] ?? [])).") ON DUPLICATE KEY UPDATE name=VALUES(name)");
foreach (($json['items'] ?? []) as $id => $it)
  $run("INSERT INTO items VALUES ('$id',".$sc($it['name']).",".$sc(!empty($it['mat'])?'material':(($it['slot']??'none')==='none'?'consumable':$it['slot'])).",".(int)($it['rarity'] ?? 1).",".(int)round((($it['dmg'][1] ?? 0)*3)+(($it['rarity'] ?? 1)*5)).",".$sc(json_encode(['slot'=>$it['slot'] ?? null,'dmg'=>$it['dmg'] ?? null,'mods'=>$it['mods'] ?? null,'lore'=>$it['lore'] ?? null])).",'◆') ON DUPLICATE KEY UPDATE name=VALUES(name)");
foreach (($json['npcs'] ?? []) as $id => $n)
  $run("INSERT INTO npcs VALUES ('$id',".$sc($n['name']).",".$sc($n['role']).",".$sc($n['faction']).",".$sc($n['loc']).",".(int)($n['offset'][0] ?? 0).",".(int)($n['offset'][1] ?? 0).",".$sc(json_encode($json['dialogs'][$id] ?? [])).",".$sc(implode(',', $n['quests'] ?? [])).") ON DUPLICATE KEY UPDATE role=VALUES(role)");
foreach (($json['recipes'] ?? []) as $r)
  $run("INSERT INTO recipes VALUES (".$sc($r['out']).",".$sc($r['out']).",".(int)($r['reqLevel'] ?? 1).",".$sc(json_encode($r['mats'] ?? [])).",".(float)($r['time'] ?? 2.5).") ON DUPLICATE KEY UPDATE mats_json=VALUES(mats_json)");
foreach (($json['abilities'] ?? []) as $a)
  $run("INSERT INTO abilities VALUES (".$sc($a['id']).",".$sc($a['name']).",".$sc($a['class'] ?? 'any').",".(int)($a['cost']['mp'] ?? 0).",".(float)($a['cd'] ?? 5).",".$sc($cut($a['desc'],185)).") ON DUPLICATE KEY UPDATE name=VALUES(name)");
foreach (($json['allQuests'] ?? []) as $q)
  $run("INSERT INTO quests VALUES (".$sc($q['id']).",".$sc($q['name']).",".(int)($q['level'] ?? 1).",".$sc($q['loc']).",".$sc($q['giver']).",".$sc($q['chain'] ?? '').",".$sc($cut($q['hint'],250)).",".$sc(json_encode($q['steps'] ?? [], JSON_UNESCAPED_UNICODE)).",".$sc(json_encode($q['reward'] ?? [], JSON_UNESCAPED_UNICODE)).",0,1) ON DUPLICATE KEY UPDATE name=VALUES(name)");
foreach (($json['instances'] ?? []) as $i)
  $run("INSERT INTO instances VALUES (".$sc($i['id']).",".(int)$i['num'].",".$sc($i['name']).",".$sc($i['theme']).",".$sc($i['baseLoc']).",".$sc($i['diff']).",".(int)$i['size'].",".(int)$i['levelMin'].",".(int)$i['levelMax'].",".(int)$i['waves'].",".$sc($i['boss']).",".(int)$i['timerMin'].",".($i['keyReq'] ? $sc($i['keyReq']) : 'NULL').",".(int)$i['rewards']['xp'].",".(int)$i['rewards']['gold'].",".$sc(json_encode($i['rewards']['loot'] ?? [])).",1) ON DUPLICATE KEY UPDATE name=VALUES(name)");

$tables = ['factions','classes','locations','mobs','items','npcs','recipes','abilities','quests','instances'];
$out = [];
foreach ($tables as $t) { $r = mysqli_fetch_row(mysqli_query($m, "SELECT COUNT(*) FROM $t")); $out[] = "$t=" . ($r[0] ?? '?'); }
echo "SEED OK: " . implode(', ', $out) . "\n";
