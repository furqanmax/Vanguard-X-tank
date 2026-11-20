const ROOM_PREFIX = 'vanguard-x-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomCode() {
  return Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
}

// Peer-to-peer rooms over PeerJS. The host's browser is the hub: every other
// player connects to it, and it relays messages between players.
export class Net {
  constructor() {
    this.peer = null;
    this.hostConn = null;
    this.isHost = false;
    this.code = null;
    this.id = null;
    this.hostId = null;
    this.conns = new Map();
    this.players = [];
    this.handlers = new Map();
    this.open = false;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  emit(type, msg) {
    for (const fn of this.handlers.get(type) || []) fn(msg);
  }

  get connected() {
    if (this.isHost) return this.open;
    return !!this.hostConn && this.hostConn.open;
  }

  createPeer(id) {
    if (!window.Peer) throw new Error('PeerJS failed to load');
    return new window.Peer(id, { debug: 0 });
  }

  createRoom(name) {
    this.disconnect();
    return new Promise((resolve, reject) => {
      const tryCode = (attempt) => {
        const code = randomCode();
        const peer = this.createPeer(ROOM_PREFIX + code);
        peer.on('open', (id) => {
          this.peer = peer;
          this.isHost = true;
          this.code = code;
          this.id = id;
          this.hostId = id;
          this.open = true;
          this.players = [{ id, name }];
          peer.on('connection', (conn) => this.acceptConnection(conn));
          peer.on('error', (err) => this.emit('error', { text: `Connection problem: ${err.type}` }));
          this.emit('joined', { code, mode: 'versus', you: id, host: id, players: this.players });
          resolve(code);
        });
        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && attempt < 5) {
            peer.destroy();
            tryCode(attempt + 1);
          } else {
            reject(new Error(`Cannot reach the connection service (${err.type})`));
          }
        });
      };
      tryCode(0);
    });
  }

  joinRoom(code, name) {
    this.disconnect();
    const peer = this.createPeer();
    this.peer = peer;
    this.code = code;
    peer.on('open', (id) => {
      this.id = id;
      this.hostId = ROOM_PREFIX + code;
      const conn = peer.connect(this.hostId, { reliable: true });
      this.hostConn = conn;
      conn.on('open', () => conn.send({ t: 'join', name }));
      conn.on('data', (msg) => this.emit(msg.t, msg));
      conn.on('close', () => this.onDisconnected());
      conn.on('error', () => this.emit('error', { text: 'Connection to the room failed' }));
    });
    peer.on('error', (err) => {
      const text = err.type === 'peer-unavailable' ? 'Room not found' : `Connection problem: ${err.type}`;
      this.emit('error', { text });
      this.disconnect();
    });
  }

  acceptConnection(conn) {
    conn.on('data', (msg) => this.hostReceive(conn, msg));
    conn.on('close', () => {
      if (!this.conns.delete(conn.peer)) return;
      this.players = this.players.filter((p) => p.id !== conn.peer);
      this.broadcast({ t: 'roster', players: this.players, host: this.hostId, left: conn.peer });
      this.emit('roster', { players: this.players, host: this.hostId });
    });
  }

  hostReceive(conn, msg) {
    if (msg.t === 'join') {
      if (this.started) {
        conn.send({ t: 'error', text: 'Match already started' });
        conn.close();
        return;
      }
      if (this.players.length >= 8) {
        conn.send({ t: 'error', text: 'Room is full' });
        conn.close();
        return;
      }
      const name = String(msg.name || 'Pilot').slice(0, 14);
      this.conns.set(conn.peer, conn);
      this.players.push({ id: conn.peer, name });
      conn.send({ t: 'joined', code: this.code, mode: 'versus', you: conn.peer, host: this.hostId, players: this.players });
      this.broadcast({ t: 'roster', players: this.players, host: this.hostId }, conn.peer);
      this.emit('roster', { players: this.players, host: this.hostId });
      return;
    }
    const out = { ...msg, from: conn.peer };
    if (msg.to !== undefined) {
      delete out.to;
      if (msg.to === this.id) this.emit(out.t, out);
      else this.conns.get(msg.to)?.send(out);
      return;
    }
    this.broadcast(out, conn.peer);
    this.emit(out.t, out);
  }

  broadcast(msg, exceptId = null) {
    for (const [id, conn] of this.conns) if (id !== exceptId && conn.open) conn.send(msg);
  }

  send(msg) {
    if (this.isHost) {
      const out = { ...msg, from: this.id };
      if (msg.to !== undefined) {
        delete out.to;
        this.conns.get(msg.to)?.send(out);
      } else {
        this.broadcast(out);
      }
      return;
    }
    if (this.hostConn?.open) this.hostConn.send(msg);
  }

  startMatch() {
    if (!this.isHost || this.started) return;
    this.started = true;
    const payload = { t: 'start', mode: 'versus', players: this.players, host: this.hostId, seed: Math.floor(Math.random() * 1e9) };
    this.broadcast(payload);
    this.emit('start', payload);
  }

  onDisconnected() {
    this.hostConn = null;
    this.open = false;
    this.emit('disconnected', {});
  }

  disconnect() {
    const peer = this.peer;
    this.peer = null;
    this.hostConn = null;
    this.isHost = false;
    this.open = false;
    this.started = false;
    this.id = null;
    this.hostId = null;
    this.code = null;
    this.players = [];
    this.conns.clear();
    if (peer && !peer.destroyed) peer.destroy();
  }
}
