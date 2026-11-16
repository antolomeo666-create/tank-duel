// Tank Duel server: serves the game and relays online matches. No npm packages needed.
// Run:  node server.js    then open  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'};

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || !TYPES[path.extname(file)]) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type':TYPES[path.extname(file)], 'Cache-Control':'no-cache'});
    res.end(data);
  });
});

// ---------- minimal WebSocket implementation (RFC 6455, text frames) ----------
function sendFrame(sock, op, data) {
  const len = data.length; let hdr;
  if (len < 126) hdr = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { hdr = Buffer.alloc(4); hdr[0] = 0x80 | op; hdr[1] = 126; hdr.writeUInt16BE(len, 2); }
  else { hdr = Buffer.alloc(10); hdr[0] = 0x80 | op; hdr[1] = 127; hdr.writeBigUInt64BE(BigInt(len), 2); }
  if (!sock.destroyed) sock.write(Buffer.concat([hdr, data]));
}
function wsConnection(sock) {
  const c = {buf:Buffer.alloc(0), frag:[], open:true, onmessage:null, onclose:null,
    send(str) { if (c.open) sendFrame(sock, 1, Buffer.from(str)); },
    close() { if (!c.open) return; c.open = false; try { sendFrame(sock, 8, Buffer.alloc(0)); } catch (e) {} sock.end(); c.onclose && c.onclose(); }};
  sock.on('data', d => {
    c.buf = Buffer.concat([c.buf, d]);
    while (c.buf.length >= 2) {
      const b0 = c.buf[0], b1 = c.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) return c.close();                       // 1 MB limit
      const mlen = masked ? 4 : 0;
      if (c.buf.length < off + mlen + len) return;
      let payload = Buffer.from(c.buf.subarray(off + mlen, off + mlen + len));
      if (masked) { const m = c.buf.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      c.buf = c.buf.subarray(off + mlen + len);
      if (op === 8) return c.close();
      if (op === 9) { sendFrame(sock, 10, payload); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) {
        c.frag.push(payload);
        if (fin) { const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = []; c.onmessage && c.onmessage(msg); }
      }
    }
  });
  const end = () => { if (c.open) { c.open = false; c.onclose && c.onclose(); } };
  sock.on('close', end); sock.on('end', end); sock.on('error', () => { end(); sock.destroy(); });
  return c;
}

// ---------- rooms: one host + one guest, messages are relayed between them ----------
const rooms = new Map();
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x');
  const key = req.headers['sec-websocket-key'];
  if (url.pathname !== '/ws' || !key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const ws = wsConnection(sock);
  const code = String(url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const role = url.searchParams.get('role');
  const fail = msg => { ws.send(JSON.stringify({t:'error', msg})); setTimeout(() => ws.close(), 50); };
  if (code.length !== 4) return fail('Invalid room code.');

  let room = rooms.get(code), side;
  if (role === 'host') {
    if (room) return fail('That room code is taken, try again.');
    room = {host:ws, guest:null}; rooms.set(code, room); side = 'host';
  } else {
    if (!room) return fail(`No game with code ${code}. Check the code with the host.`);
    if (room.guest) return fail('That game is already full.');
    room.guest = ws; side = 'guest';
  }
  ws.send(JSON.stringify({t:'joined', role:side}));
  if (side === 'guest') { room.host.send('{"t":"peer"}'); ws.send('{"t":"peer"}'); }
  console.log(`[room ${code}] ${side} connected`);

  ws.onmessage = msg => { const other = side === 'host' ? room.guest : room.host; if (other) other.send(msg); };
  ws.onclose = () => {
    console.log(`[room ${code}] ${side} left`);
    if (side === 'host') { if (room.guest) { room.guest.send('{"t":"peerleft"}'); room.guest.close(); } rooms.delete(code); }
    else { room.guest = null; room.host.send('{"t":"peerleft"}'); }
  };
});

server.listen(PORT, () => {
  console.log(`\n  Tank Duel is running!\n\n  On this computer:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  On your network:   http://${a.address}:${PORT}`);
  console.log('\n  For online play, the other player opens the network address and joins your room code.\n');
});
