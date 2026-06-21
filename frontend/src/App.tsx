import { useState, useRef, useCallback } from 'react';
import { useCRDTDocument } from './hooks/useCRDTDocument';
import { useWebSocket } from './hooks/useWebSocket';

const CLIENT_ID = Math.random().toString(36).slice(2, 10);

function App() {
  const [name] = useState(`User-${CLIENT_ID.slice(0, 4)}`);
  const { text, insertLocal, deleteLocal, applyRemote } = useCRDTDocument(CLIENT_ID);
  const [presence, setPresence] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTextRef = useRef('');

  const { connected, sendOp } = useWebSocket({
    roomId: 'demo-room',
    clientId: CLIENT_ID,
    name,
    onOp: (op) => applyRemote(op),
    onSync: (ops) => ops.forEach(op => applyRemote(op)),
    onPresence: (clients) => setPresence(clients),
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const oldText = prevTextRef.current;

    // Naive diff: find first point of difference (good enough for single
    // keystrokes, which is the common case for a real typing user)
    let i = 0;
    while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) i++;

    if (newText.length > oldText.length) {
      // Characters were inserted starting at index i
      const inserted = newText.slice(i, i + (newText.length - oldText.length));
      let insertIndex = i;
      for (const char of inserted) {
        const op = insertLocal(insertIndex, char);
        sendOp(op);
        insertIndex++;
      }
    } else if (newText.length < oldText.length) {
      // Characters were deleted starting at index i
      const deleteCount = oldText.length - newText.length;
      for (let d = 0; d < deleteCount; d++) {
        const op = deleteLocal(i);
        sendOp(op);
      }
    }

    prevTextRef.current = newText;
  }, [insertLocal, deleteLocal, sendOp]);

  // Keep the textarea in sync when remote ops change `text`
  if (textareaRef.current && document.activeElement !== textareaRef.current) {
    prevTextRef.current = text;
  }

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
