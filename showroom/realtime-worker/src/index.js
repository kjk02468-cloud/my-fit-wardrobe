// STRATA 실시간 방(Cloudflare Workers + Durable Objects, WebSocket Hibernation)
// - 방 하나당 최대 MAX명. 넘치면 접속 직후 4001 코드로 닫는다(클라이언트가 '정원 초과'를 보여 줌).
// - 메시지(JSON): join{name,outfit} · s{x,z,yaw,w} 위치(최대 초당 20회만 중계) · o{outfit} · c{text} 채팅
// - 서버는 저장하지 않는다(접속 중인 사람의 이름·위치·코디만 메모리/첨부에 보관, 나가면 사라짐).
import { DurableObject } from 'cloudflare:workers';

const MAX = 10;
const ALLOWED_ORIGINS = [/^https:\/\/kjk02468-cloud\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const OUTFIT_KEYS = ['outer', 'top', 'bottom', 'shoes'];
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const cleanOutfit = o => Object.fromEntries(OUTFIT_KEYS.map(k => [k, clean(o?.[k], 40)]));
const num = v => (Number.isFinite(+v) ? Math.round(+v * 1000) / 1000 : 0);

export class Room extends DurableObject {
  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const full = this.ctx.getWebSockets().length >= MAX;
    this.ctx.acceptWebSocket(server);
    if (full) {
      server.serializeAttachment({ full: true });
      server.send(JSON.stringify({ t: 'full', max: MAX }));
      server.close(4001, 'room full');
    } else {
      const id = crypto.randomUUID().slice(0, 8);
      server.serializeAttachment({ id, name: null, outfit: null, st: null, last: 0 });
      server.send(JSON.stringify({ t: 'welcome', id, max: MAX, peers: this.peers(server) }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  peers(except) {
    return this.ctx.getWebSockets().filter(w => w !== except).map(w => w.deserializeAttachment()).filter(a => a && a.name)
      .map(a => ({ id: a.id, name: a.name, outfit: a.outfit, st: a.st }));
  }

  count() { return this.ctx.getWebSockets().map(w => w.deserializeAttachment()).filter(a => a && a.name).length; }

  bcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const w of this.ctx.getWebSockets()) if (w !== except) { try { w.send(s); } catch (e) { /* 끊긴 소켓 */ } }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const a = ws.deserializeAttachment();
    if (!a || a.full) return;
    if (m.t === 'join' && !a.name) {
      a.name = clean(m.name, 16) || '게스트'; a.outfit = cleanOutfit(m.outfit); ws.serializeAttachment(a);
      this.bcast({ t: 'join', id: a.id, name: a.name, outfit: a.outfit, n: this.count() }, ws);
      ws.send(JSON.stringify({ t: 'count', n: this.count(), max: MAX }));
      return;
    }
    if (!a.name) return;
    if (m.t === 's') {
      const now = Date.now(); if (now - a.last < 50) return;          // 초당 20회 상한
      a.last = now; a.st = { x: num(m.x), z: num(m.z), yaw: num(m.yaw), w: !!m.w }; ws.serializeAttachment(a);
      this.bcast({ t: 's', id: a.id, ...a.st }, ws);
    } else if (m.t === 'o') {
      a.outfit = cleanOutfit(m.outfit); ws.serializeAttachment(a);
      this.bcast({ t: 'o', id: a.id, outfit: a.outfit }, ws);
    } else if (m.t === 'c') {
      const text = clean(m.text, 200); if (!text) return;
      this.bcast({ t: 'c', id: a.id, name: a.name, text });                // 보낸 사람 포함 전원
    }
  }

  leave(ws) {
    const a = ws.deserializeAttachment();
    if (a && a.name) this.bcast({ t: 'leave', id: a.id, n: Math.max(0, this.count() - 1) }, ws);
  }
  async webSocketClose(ws, code) { this.leave(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {} }
  async webSocketError(ws) { this.leave(ws); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    if (url.pathname === '/room') {
      const origin = request.headers.get('Origin') || '';
      if (!ALLOWED_ORIGINS.some(r => r.test(origin))) return new Response('origin not allowed', { status: 403 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const name = clean(url.searchParams.get('r') || 'main', 32).replace(/[^a-z0-9-]/gi, '') || 'main';
      return env.ROOM.get(env.ROOM.idFromName(name)).fetch(request);
    }
    return new Response('STRATA realtime', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
