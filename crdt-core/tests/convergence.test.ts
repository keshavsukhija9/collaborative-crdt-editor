import { describe, it, expect } from 'vitest';
import { CRDTDocument } from '../src/document';

describe('convergence — core guarantee', () => {
  it('sequential edits applied out of order still converge', () => {
    const docA = new CRDTDocument('A');
    const docB = new CRDTDocument('B');

    const op1 = docA.localInsert(0, 'H');
    const op2 = docA.localInsert(1, 'i');

    // Apply to B in REVERSE order
    docB.applyOperation(op2);
    docB.applyOperation(op1);

    expect(docB.toString()).toBe(docA.toString());
  });

  it('two clients concurrently inserting at the same anchor converge to the same result', () => {
    const base = new CRDTDocument('base');
    const op1 = base.localInsert(0, 'X');

    const docA = new CRDTDocument('A');
    const docB = new CRDTDocument('B');
    docA.applyOperation(op1);
    docB.applyOperation(op1);

    const opA = docA.localInsert(1, 'a');
    const opB = docB.localInsert(1, 'b');

    docA.applyOperation(opB);
    docB.applyOperation(opA);

    expect(docA.toString()).toBe(docB.toString());
  });

  it('concurrent delete of the same character is idempotent', () => {
    const base = new CRDTDocument('base');
    const op1 = base.localInsert(0, 'X');

    const docA = new CRDTDocument('A');
    const docB = new CRDTDocument('B');
    docA.applyOperation(op1);
    docB.applyOperation(op1);

    const delA = docA.localDelete(0);
    const delB = docB.localDelete(0);

    docA.applyOperation(delB);
    docB.applyOperation(delA);

    expect(docA.toString()).toBe('');
    expect(docB.toString()).toBe('');
  });
});

describe('known limitations — documented, not hidden', () => {
  it.todo(
    'deep chains of concurrent inserts at the same anchor point are not ' +
    'guaranteed correct order under all interleavings — this would require ' +
    'full LSEQ-style position allocation, which is explicitly out of scope'
  );

  it.todo(
    'delete arriving before its corresponding insert is silently dropped ' +
    'rather than buffered and retried — a real system would need an ' +
    'out-of-order operation buffer'
  );
});
