import { WebSocket } from 'ws';
import type { Operation } from 'crdt-core';

interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  name: string;
  cursorPosition: number;
  docHash: string;
}

export class Room {
  private clients: Map<string, ConnectedClient> = new Map();
  private opLog: Operation[] = [];

  join(clientId: string, ws: WebSocket, name: string): void {
    this.clients.set(clientId, { ws, clientId, name, cursorPosition: 0, docHash: '' });

    // Send the full op log so the new client can reconstruct document state
    ws.send(JSON.stringify({ type: 'sync', ops: this.opLog }));

    this.broadcastPresence();
  }

  leave(clientId: string): void {
    this.clients.delete(clientId);
    this.broadcastPresence();
  }

  // The server is deliberately dumb here — it does not resolve conflicts,
  // does not decide ordering. It just stores the op and relays it.
  // Every client's own CRDTDocument does the actual conflict-free merge.
  broadcastOp(op: Operation, senderClientId: string): void {
    this.opLog.push(op);
    for (const [id, client] of this.clients) {
      if (id !== senderClientId) {
        client.ws.send(JSON.stringify({ type: 'op', op }));
      }
    }
  }

  updateCursor(clientId: string, position: number, docHash: string): void {
    const client = this.clients.get(clientId);
    if (client) { client.cursorPosition = position; client.docHash = docHash; }
    this.broadcastPresence();
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private broadcastPresence(): void {
    const presence = Array.from(this.clients.values()).map(c => ({
      clientId: c.clientId,
      name: c.name,
      cursorPosition: c.cursorPosition,
      docHash: c.docHash,
    }));
    const message = JSON.stringify({
      type: 'presence',
      clients: presence,
      count: presence.length,
    });
    for (const client of this.clients.values()) {
      client.ws.send(message);
    }
  }
}
