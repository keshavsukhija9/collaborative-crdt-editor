# Collaborative CRDT Text Editor

Real-time collaborative editing built from scratch — no Yjs, no Automerge, no operational transform library. The conflict resolution is hand-rolled.

Open two tabs, type in both at the same time. Both documents converge to the same state. That's the guarantee a CRDT provides, and it works here without any central arbitration.

---

## What this actually does

Most "real-time editors" you see in portfolios are just socket.io chat with a textarea. This is different.

The hard problem in collaborative editing is what happens when two people edit the same position at the same time. If client A inserts 'x' at index 5 while client B deletes the character at index 5, and both ops arrive at each client in different orders — what should the final document look like? It needs to be **identical on both clients**, regardless of network delays or op ordering.

This project solves that with a sequence CRDT. Every character gets a globally unique ID (clientId + logical clock). Inserts carry an origin anchor. Conflicts are resolved deterministically using clock-then-clientId comparison. The server never sees a conflict — it's a dumb relay. All merging happens client-side.

The op log panel on the right side of the UI makes this visible — you can watch ops from different clients arriving with different vector clocks, and see both documents stay in sync.

---

## Stack

- **CRDT core** — pure TypeScript, zero dependencies. Sequence CRDT with tombstone deletes and origin-left anchoring.
- **Server** — Node.js + `ws`. Stateless relay: stores op log for late-joining clients, broadcasts presence, does zero conflict resolution.
- **Frontend** — React 19 + Vite. Textarea-based editor with real-time op visualization panel and colored per-user presence.

Monorepo structure — `crdt-core` is a local workspace package consumed by both server and frontend.

---

## Run locally

```bash
git clone https://github.com/keshavsukhija9/collaborative-crdt-editor
cd collaborative-crdt-editor

# Install deps across all packages
cd crdt-core && npm install && npm run build && cd ..
cd server && npm install && cd ..
cd frontend && npm install && cd ..

# Terminal 1 — start server
cd server && npm run dev

# Terminal 2 — start frontend
cd frontend && npm run dev
```

Open `http://localhost:5173` in two tabs. Type in both simultaneously.

---

## How the CRDT works

Each character in the document is a node:

```ts
CharNode {
  id: { clientId: string, clock: number }  // globally unique position
  char: string
  originLeft: CharId | null                // insertion anchor
  deleted: boolean                         // tombstone — never truly removed
}
```

When two clients insert at the same position concurrently, the tie-break is `clock DESC → clientId lexicographic`. This is deterministic across all clients — no coordination needed.

Deletes are tombstones. The node stays in the list, marked `deleted: true`. This avoids the classic "delete before insert arrives" race condition.

Known limitations (intentional scope decisions, not bugs):
- Deep concurrent insertion chains don't guarantee full LSEQ ordering — would need a complete Logoot/LSEQ implementation to fix, out of scope here
- Out-of-order deletes (delete arrives before its insert) are silently dropped — production would buffer and retry
- Op log is in-memory — server restart clears history

---

## Tests

```bash
cd crdt-core && npm test
```

Covers: out-of-order sequential edits, concurrent inserts at same anchor, concurrent deletes (idempotency).
