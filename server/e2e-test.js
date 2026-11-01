// E2E-тест связки Сервер+MySQL+WS: node server/e2e-test.js [порт]
const http = require('http');
const path = require('path');
const { WebSocket } = require(path.join(__dirname, 'node_modules', 'ws'));
const PORT = parseInt(process.argv[2] || '3000', 10);
function req(method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p,
      headers: { 'Content-Type': 'application/json', ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } },
      res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve({ code: res.statusCode, json: b ? JSON.parse(b) : null }); } catch (e) { reject(new Error('bad json: ' + b.slice(0, 80))); } }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
let fails = 0; const ok = (name, cond) => { console.log((cond ? '[OK]  ' : '[FAIL]') + ' ' + name); if (!cond) fails++; };
(async () => {
  const ping = await req('GET', '/api/ping'); ok('ping', ping.json && ping.json.ok);
  // регистрация нового аккаунта (или вход существующего)
  const email = 'e2e@nvr.game';
  await req('POST', '/api/register', { email, password: 'nightfall', nick: 'E2E' }).catch(() => {});
  const tok = await req('POST', '/api/token', { email, password: 'nightfall' });
  ok('token issued', !!(tok.json && tok.json.token));
  const T = encodeURIComponent(tok.json.token);
  const save = await req('POST', `/api/character/nwm-1?token=${T}`, { name: 'НочнойКузнец', level: 5, hp: 120, world: 'nwm-1', inv: ['руда'] });
  ok('character save -> MySQL', save.code === 200 && save.json && save.json.ok);
  const load = await req('GET', `/api/character/nwm-1?token=${T}`);
  ok('character load <- MySQL', load.code === 200 && load.json && load.json.name === 'НочнойКузнец' && load.json.level === 5);
  const list = await req('GET', `/api/characters?token=${T}`);
  ok('character list', list.code === 200 && Array.isArray(list.json) && list.json.length >= 1);
  const bad = await req('GET', '/api/character/nwm-1?token=неттокена');
  ok('reject bad token (401)', bad.code === 401);
  // WS: два клиента
  const ws1 = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const ws2 = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const events = [];
  ws2.on('message', m => { try { events.push(JSON.parse(m.toString())); } catch (_) {} });
  await Promise.all([new Promise(r => ws1.once('open', r)), new Promise(r => ws2.once('open', r))]);
  ws1.send(JSON.stringify({ type: 'hello', name: 'Первый', world: 'nwm-1', level: 5, cls: 'blazewright' }));
  await new Promise(r => setTimeout(r, 400));
  ws2.send(JSON.stringify({ type: 'hello', name: 'Второй', world: 'nwm-1' }));
  await new Promise(r => setTimeout(r, 300));
  ws1.send(JSON.stringify({ type: 'move', x: 10, z: -5 }));
  ws1.send(JSON.stringify({ type: 'chat', text: 'Здравствуй, Эфирия!', channel: 'global' }));
  await new Promise(r => setTimeout(r, 600));
  const has = t => events.some(e => e.type === t);
  ok('ws welcome', has('welcome')); ok('ws spawn (second player visible)', has('spawn'));
  ok('ws move broadcast', has('move')); ok('ws chat broadcast', has('chat'));
  try { ws1.close(); ws2.close(); } catch (_) {}
  const st = await req('GET', '/api/status').catch(() => ({ json: {} }));
  console.log('server status:', JSON.stringify(st.json).slice(0, 120));
  console.log(fails ? `E2E FAIL (${fails})` : 'E2E OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E CRASH:', e.message); process.exit(1); });
