import { useState, useRef, useCallback, useEffect } from 'react';
import { useCRDTDocument } from './hooks/useCRDTDocument';
import { useWebSocket } from './hooks/useWebSocket';

const CLIENT_ID = Math.random().toString(36).slice(2, 10);

const COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

function getColor(clientId: string): string {
  let hash = 0;
  for (const c of clientId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[hash % COLORS.length];
}

interface OpEntry {
  id: number;
  type: 'insert' | 'delete';
  clientId: string;
  clock: number;
  index: number;
  char?: string;
  source: 'local' | 'remote';
}

function App() {
  const [name] = useState(`User-${CLIENT_ID.slice(0, 4)}`);
  const { text, insertLocal, deleteLocal, applyRemote } = useCRDTDocument(CLIENT_ID);
  const [presence, setPresence] = useState<any[]>([]);
  const [opLog, setOpLog] = useState<OpEntry[]>([]);
  const opCountRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTextRef = useRef('');
  const isApplyingRemoteRef = useRef(false);

  const addOp = useCallback((entry: Omit<OpEntry, 'id'>) => {
    setOpLog(prev => [{ ...entry, id: ++opCountRef.current }, ...prev].slice(0, 150));
  }, []);

  const { connected, sendOp, sendCursor } = useWebSocket({
    roomId: 'demo-room',
    clientId: CLIENT_ID,
    name,
    onOp: (op) => {
      isApplyingRemoteRef.current = true;
      applyRemote(op);
      isApplyingRemoteRef.current = false;
      const o = op as any;
      if (op.type === 'insert') {
        addOp({ type: 'insert', clientId: o.node.id.clientId, clock: o.node.id.clock, index: -1, char: o.node.char, source: 'remote' });
      } else {
        addOp({ type: 'delete', clientId: o.id.clientId, clock: o.id.clock, index: -1, source: 'remote' });
      }
    },
    onSync: (ops) => {
      isApplyingRemoteRef.current = true;
      ops.forEach(op => applyRemote(op));
      isApplyingRemoteRef.current = false;
    },
    onPresence: (clients) => setPresence(clients),
  });

  useEffect(() => {
    prevTextRef.current = text;
  }, [text]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isApplyingRemoteRef.current) return;

    const newText = e.target.value;
    const oldText = prevTextRef.current;

    let i = 0;
    while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) i++;

    if (newText.length > oldText.length) {
      const inserted = newText.slice(i, i + (newText.length - oldText.length));
      let insertIndex = i;
      for (const char of inserted) {
        const op = insertLocal(insertIndex, char);
        sendOp(op);
        const o = op as any;
        addOp({ type: 'insert', clientId: CLIENT_ID, clock: o.node?.id?.clock ?? 0, index: insertIndex, char, source: 'local' });
        insertIndex++;
      }
    } else if (newText.length < oldText.length) {
      const deleteCount = oldText.length - newText.length;
      for (let d = 0; d < deleteCount; d++) {
        const op = deleteLocal(i);
        sendOp(op);
        const o = op as any;
        addOp({ type: 'delete', clientId: CLIENT_ID, clock: o.id?.clock ?? 0, index: i, source: 'local' });
      }
    }

    prevTextRef.current = newText;
  }, [insertLocal, deleteLocal, sendOp, addOp]);

  const handleCursorMove = useCallback(() => {
    const pos = textareaRef.current?.selectionStart ?? 0;
    sendCursor(pos);
  }, [sendCursor]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'monospace', background: '#0d1117', color: '#c9d1d9', overflow: 'hidden' }}>

      {/* ── Left: editor ── */}
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>Collaborative CRDT Editor</h2>
          <span style={{
            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold',
            background: connected ? '#27ae6033' : '#c0392b33',
            color: connected ? '#2ecc71' : '#e74c3c',
            border: `1px solid ${connected ? '#2ecc71' : '#e74c3c'}`,
          }}>
            {connected ? '● LIVE' : '● OFFLINE'}
          </span>
        </div>

        {/* Presence badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 28 }}>
          {presence.map(p => (
            <div key={p.clientId} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 20, fontSize: 11,
              background: `${getColor(p.clientId)}18`,
              border: `1px solid ${getColor(p.clientId)}66`,
              color: getColor(p.clientId),
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: getColor(p.clientId), display: 'inline-block' }} />
              {p.name}{p.clientId === CLIENT_ID ? ' (you)' : ''}
              <span style={{ opacity: 0.6, fontSize: 10 }}>:{p.cursorPosition}</span>
            </div>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onSelect={handleCursorMove}
          onKeyUp={handleCursorMove}
          onClick={handleCursorMove}
          placeholder="Start typing to collaborate... Open a second tab to see CRDT in action."
          style={{
            flex: 1, fontSize: 15, padding: 16, lineHeight: 1.7,
            background: '#161b22', color: '#e6edf3',
            border: '1px solid #30363d', borderRadius: 8,
            resize: 'none', outline: 'none',
          }}
        />

        <div style={{ fontSize: 11, color: '#484f58' }}>
          client: <span style={{ color: getColor(CLIENT_ID) }}>{CLIENT_ID}</span>
          &nbsp;|&nbsp;chars: {text.length}
          &nbsp;|&nbsp;ops logged: {opLog.length}
        </div>
      </div>

      {/* ── Right: op log panel ── */}
      <div style={{ width: 340, background: '#161b22', borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #30363d' }}>
          <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold' }}>
            CRDT Operation Log
          </div>
          <div style={{ fontSize: 11, color: '#484f58', marginTop: 3 }}>
            {opLog.length} ops · newest first
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #21262d', display: 'flex', gap: 12, fontSize: 10, color: '#8b949e' }}>
          <span><span style={{ color: '#2ecc71' }}>■</span> INSERT</span>
          <span><span style={{ color: '#e74c3c' }}>■</span> DELETE</span>
          <span style={{ marginLeft: 'auto' }}>↑ local &nbsp; ↓ remote</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {opLog.length === 0 ? (
            <div style={{ padding: 20, color: '#484f58', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
              Operations appear here as you type.<br />
              Each keystroke generates a CRDT op with a unique vector clock ID.
            </div>
          ) : (
            opLog.map(op => (
              <div key={op.id} style={{
                padding: '7px 10px', marginBottom: 3, borderRadius: 6,
                background: op.source === 'local' ? '#1c2128' : '#12171e',
                borderLeft: `3px solid ${getColor(op.clientId)}`,
                fontSize: 11,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{
                    padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 'bold',
                    background: op.type === 'insert' ? '#2ecc7122' : '#e74c3c22',
                    color: op.type === 'insert' ? '#2ecc71' : '#e74c3c',
                  }}>
                    {op.type.toUpperCase()}
                  </span>
                  <span style={{ color: '#484f58', fontSize: 10 }}>
                    {op.source === 'local' ? '↑ local' : '↓ remote'}
                  </span>
                </div>
                <div style={{ color: getColor(op.clientId), marginBottom: 1 }}>
                  client <span style={{ opacity: 0.8 }}>{op.clientId.slice(0, 8)}</span>
                </div>
                <div style={{ color: '#8b949e' }}>
                  clock: <span style={{ color: '#f0e68c' }}>{op.clock}</span>
                  {op.char !== undefined && (
                    <span> · char: <span style={{ color: '#79c0ff' }}>'{op.char === '\n' ? '↵' : op.char === ' ' ? '·' : op.char}'</span></span>
                  )}
                  {op.index >= 0 && (
                    <span> · idx: <span style={{ color: '#d2a8ff' }}>{op.index}</span></span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
