// ============ ONLINE: WebSocket client (talks to server.js) ============
const Net = {
  ws:null, role:null, room:null, peer:false, peerCk:null, remoteIn:null, handlers:{},
  on(t, fn) { this.handlers[t] = fn; },
  connect(room, role) {
    this.close();
    this.room = room; this.role = role === 'host' ? 'host' : 'guest'; this.peer = false; this.peerCk = null; this.remoteIn = null;
    let ws;
    try {
      if (!/^https?:$/.test(location.protocol)) throw new Error('no server');
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(room)}&role=${role}`);
    } catch (e) { this.emit('error', {msg:'Online play needs the game server: run "node server.js" and open http://localhost:3000'}); this.role = null; return; }
    this.ws = ws;
    let opened = false;
    ws.onopen = () => { opened = true; };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.emit(m.t, m); };
    ws.onerror = () => { if (!opened) this.emit('error', {msg:'Could not reach the game server. Run "node server.js" and open the game from http://localhost:3000'}); };
    ws.onclose = () => { if (this.ws === ws) { const was = this.role; this.ws = null; this.role = null; this.peer = false; if (opened && was) this.emit('closed', {}); } };
  },
  emit(t, m) { const h = this.handlers[t]; if (h) h(m); },
  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); },
  close() { if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) {} } this.role = null; this.peer = false; },
  get active() { return !!this.ws && !!this.role; },
};
