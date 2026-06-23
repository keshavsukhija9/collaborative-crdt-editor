import { WebSocket } from 'ws';

// Simulates a client connected to the server
function createClient(clientId, name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:8080?room=integration-test&clientId=${clientId}&name=${name}`);
    const receivedOps = [];
    let syncOps = [];
    let onOpCallback = null;

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'sync') syncOps = msg.ops;
      if (msg.type === 'op') {
        receivedOps.push(msg.op);
        if (onOpCallback) onOpCallback(msg.op);
      }
    });

    ws.on('open', () => {
      resolve({
        sendOp: (op) => ws.send(JSON.stringify({ type: 'op', op })),
        getReceivedOps: () => receivedOps,
        getSyncOps: () => syncOps,
        onOp: (cb) => { onOpCallback = cb; },
        close: () => ws.close(),
      });
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Build a simple insert op manually (bypasses CRDT, tests server relay only)
function makeInsertOp(clientId, clock, char, originLeft = null) {
  return {
    type: 'insert',
    node: {
      id: { clientId, clock },
      char,
      originLeft,
      deleted: false,
    }
  };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('\nRunning integration tests against live server...\n');

  // Test 1: op sent by client A is received by client B
  {
    const name = 'Test 1: op broadcast';
    const clientA = await createClient('integ-A', 'Alice');
    const clientB = await createClient('integ-B', 'Bob');

    await sleep(100); // let both join

    const op = makeInsertOp('integ-A', 0, 'H');

    let received = false;
    clientB.onOp((incoming) => {
      if (incoming.node?.char === 'H') received = true;
    });

    clientA.sendOp(op);
    await sleep(200);

    if (received) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name} — B never received A's op`);
      failed++;
    }

    clientA.close();
    clientB.close();
    await sleep(100);
  }

  // Test 2: sender does NOT receive their own op back
  {
    const name = 'Test 2: no echo to sender';
    const clientA = await createClient('integ-A2', 'Alice2');
    const clientB = await createClient('integ-B2', 'Bob2');

    await sleep(100);

    let selfReceived = false;
    clientA.onOp(() => { selfReceived = true; });

    clientA.sendOp(makeInsertOp('integ-A2', 0, 'X'));
    await sleep(200);

    if (!selfReceived) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name} — sender received their own op`);
      failed++;
    }

    clientA.close();
    clientB.close();
    await sleep(100);
  }

  // Test 3: new client joining receives full op log
  {
    const name = 'Test 3: new client receives sync';
    const clientA = await createClient('integ-A3', 'Alice3');
    await sleep(100);

    clientA.sendOp(makeInsertOp('integ-A3', 0, 'H'));
    clientA.sendOp(makeInsertOp('integ-A3', 1, 'i'));
    await sleep(200);

    // Client B joins AFTER ops were sent
    const clientB = await createClient('integ-B3', 'Bob3');
    await sleep(300);

    const syncOps = clientB.getSyncOps();
    const hasOps = syncOps.length >= 2;

    if (hasOps) {
      console.log(`  ✓ ${name} (received ${syncOps.length} ops on join)`);
      passed++;
    } else {
      console.log(`  ✗ ${name} — only got ${syncOps.length} ops, expected >=2`);
      failed++;
    }

    clientA.close();
    clientB.close();
    await sleep(100);
  }

  // Test 4: concurrent ops from two clients both reach each other
  {
    const name = 'Test 4: concurrent ops — both delivered cross-client';
    const clientA = await createClient('integ-A4', 'Alice4');
    const clientB = await createClient('integ-B4', 'Bob4');

    await sleep(100);

    let aGotB = false;
    let bGotA = false;

    clientA.onOp((op) => { if (op.node?.id?.clientId === 'integ-B4') aGotB = true; });
    clientB.onOp((op) => { if (op.node?.id?.clientId === 'integ-A4') bGotA = true; });

    // Fire both simultaneously
    clientA.sendOp(makeInsertOp('integ-A4', 0, 'a'));
    clientB.sendOp(makeInsertOp('integ-B4', 0, 'b'));

    await sleep(300);

    if (aGotB && bGotA) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name} — aGotB:${aGotB} bGotA:${bGotA}`);
      failed++;
    }

    clientA.close();
    clientB.close();
    await sleep(100);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
