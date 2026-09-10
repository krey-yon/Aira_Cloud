import type { ServerWebSocket } from "bun";
import type { ServerToClientMessage } from "../shared/agent";

export type SocketData = {
  clientId?: string;
  authed: boolean;
};

const ONLINE_TTL_MS = 90_000;

export class ClientRegistry {
  private readonly byClient = new Map<string, Set<ServerWebSocket<SocketData>>>();
  private readonly lastSeen = new Map<string, number>();

  attach(clientId: string, ws: ServerWebSocket<SocketData>) {
    if (ws.data.clientId && ws.data.clientId !== clientId) {
      this.detach(ws);
    }
    ws.data.clientId = clientId;
    let set = this.byClient.get(clientId);
    if (!set) {
      set = new Set();
      this.byClient.set(clientId, set);
    }
    set.add(ws);
    this.touch(clientId);
  }

  detach(ws: ServerWebSocket<SocketData>) {
    const clientId = ws.data.clientId;
    if (!clientId) return;
    const set = this.byClient.get(clientId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      this.byClient.delete(clientId);
      // Keep lastSeen so a brief reconnect window still counts as recently online.
    }
  }

  touch(clientId: string) {
    this.lastSeen.set(clientId, Date.now());
  }

  isOnline(clientId: string, now = Date.now()): boolean {
    const seen = this.lastSeen.get(clientId);
    if (seen != null && now - seen <= ONLINE_TTL_MS) return true;
    const set = this.byClient.get(clientId);
    return Boolean(set && set.size > 0);
  }

  anyOnline(now = Date.now()): boolean {
    for (const clientId of this.lastSeen.keys()) {
      if (this.isOnline(clientId, now)) return true;
    }
    for (const [clientId, set] of this.byClient) {
      if (set.size > 0) {
        this.touch(clientId);
        return true;
      }
    }
    return false;
  }

  presenceSnapshot() {
    const now = Date.now();
    return [...this.lastSeen.entries()].map(([clientId, at]) => ({
      clientId,
      lastSeenAt: at,
      online: this.isOnline(clientId, now),
    }));
  }

  send(clientId: string, message: ServerToClientMessage) {
    const set = this.byClient.get(clientId);
    if (!set?.size) return;
    const payload = JSON.stringify(message);
    for (const ws of set) {
      try {
        ws.send(payload);
      } catch {
        // drop broken sockets on next close
      }
    }
  }
}
