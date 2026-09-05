import type { ServerWebSocket } from "bun";
import type { ServerToClientMessage } from "../../../shared/agent";

export type SocketData = {
  clientId?: string;
  authed: boolean;
};

export class ClientRegistry {
  private readonly byClient = new Map<string, Set<ServerWebSocket<SocketData>>>();

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
  }

  detach(ws: ServerWebSocket<SocketData>) {
    const clientId = ws.data.clientId;
    if (!clientId) return;
    const set = this.byClient.get(clientId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.byClient.delete(clientId);
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
