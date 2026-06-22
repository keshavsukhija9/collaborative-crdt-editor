import { useState, useRef, useCallback, useEffect } from 'react';
import { useCRDTDocument } from './hooks/useCRDTDocument';
import { useWebSocket } from './hooks/useWebSocket';

const CLIENT_ID = Math.random().toString(36).slice(2, 10);

function App() {
  const [name] = useState(`User-${CLIENT_ID.slice(0, 4)}`);
  const { text, insertLocal, deleteLocal, applyRemote } = useCRDTDocument(CLIENT_ID);
  const [presence, setPresence] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTextRef = useRef('');
  const isApplyingRemoteRef = useRef(false);

  const { connected, sendOp } = useWebSocket({
    roomId: 'demo-room',
    clientId: CLIENT_ID,
    name,
    onOp: (op) => {
      isApplyingRemoteRef.current = true;
      applyRemote(op);
      isApplyingRemoteRef.current = false;
    },
    onSync: (ops) => {
      isApplyingRemoteRef.current = true;
      ops.forEach(op => applyRemote(op));
      isApplyingRemoteRef.current = false;
    },
    onPresence: (clients) => setPresence(clients),
  });

  // Keep prevTextRef in sync with text changes from remote ops
  // useEffect fires after render, so the textarea has already updated
  // by the time we sync prevTextRef — this prevents stale diffs
  useEffect(() => {
    prevTextRef.current = text;
  }, [text]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // If a remote op is currently being applied, ignore this change event —
    // it was triggered by the controlled value update, not by the user
    if (isApplyingRemoteRef.current) return;

    const newText = e.target.value;
    const oldText = prevTextRef.current;

    // Naive diff: find first point of difference
    let i = 0;
    while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) i++;

    if (newText.length > oldText.length) {
      const inserted = newText.slice(i, i + (newText.length - oldText.length));
      let insertIndex = i;
      for (const char of inserted) {
        const op = insertLocal(insertIndex, char);
        sendOp(op);
        insertIndex++;
      }
    } else if (newText.length < oldText.length) {
      const deleteCount = oldText.length - newText.length;
      for (let d = 0; d < deleteCount; d++) {
        const op = deleteLocal(i);
        sendOp(op);
      }
    }
  }, [insertLocal, deleteLocal, sendOp]);

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h2>Collaborative CRDT Editor</h2>
      <p>Status: {connected ? '🟢 connected' : '🔴 disconnected'} | Client: {name}</p>
      <p>Online: {presence.map(p => p.name).join(', ')}</p>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        style={{ width: '600px', height: '300px', fontSize: '16px', padding: '10px' }}
      />
    </div>
  );
}

export default App;
