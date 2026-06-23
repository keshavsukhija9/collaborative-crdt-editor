import { useEffect, useRef, useState, useCallback } from 'react';
import type { Operation } from 'crdt-core';

interface UseWebSocketOptions {
  roomId: string;
  clientId: string;
  name: string;
  onOp: (op: Operation) => void;
  onSync: (ops: Operation[]) => void;
  onPresence: (clients: any[]) => void;
}

export function useWebSocket({ roomId, clientId, name, onOp, onSync, onPresence }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const url = `${import.meta.env.VITE_WS_URL ?? "ws://localhost:8080"}?room=${roomId}&clientId=${clientId}&name=${encodeURIComponent(name)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'op') onOp(message.op);
      else if (message.type === 'sync') onSync(message.ops);
      else if (message.type === 'presence') onPresence(message.clients);
    };

    return () => ws.close();
  }, [roomId, clientId, name]);

  const sendOp = useCallback((op: Operation) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'op', op }));
    }
  }, []);

  const sendCursor = useCallback((position: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor', position }));
    }
  }, []);

  return { connected, sendOp, sendCursor };
}
