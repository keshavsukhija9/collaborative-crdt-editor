import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './roomManager';
import type { Operation } from 'crdt-core';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const roomManager = new RoomManager();
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const roomId = url.searchParams.get('room') || 'default';
  const clientId = url.searchParams.get('clientId') || crypto.randomUUID();
  const name = url.searchParams.get('name') || 'Anonymous';

  const room = roomManager.getOrCreate(roomId);
  room.join(clientId, ws, name);

  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(data.toString());

    if (message.type === 'op') {
      room.broadcastOp(message.op as Operation, clientId);
    } else if (message.type === 'cursor') {
      room.updateCursor(clientId, message.position, message.docHash ?? "");
    }
  });

  ws.on('close', () => {
    room.leave(clientId);
  });
});
