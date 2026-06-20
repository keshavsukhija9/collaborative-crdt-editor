import { CharId, CharNode, Operation, InsertOp, DeleteOp } from './types';
import { compareIds, idsEqual } from './compare';

export class CRDTDocument {
  private nodes: CharNode[] = [];
  private clientId: string;
  private clock: number = 0;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  // Called when the local user types a character at a given index
  localInsert(index: number, char: string): InsertOp {
    const visibleNodes = this.nodes.filter(n => !n.deleted);
    const originLeft = index > 0 ? visibleNodes[index - 1].id : null;

    const node: CharNode = {
      id: { clientId: this.clientId, clock: this.clock++ },
      char,
      originLeft,
      deleted: false,
    };

    this.applyInsert(node);
    return { type: 'insert', node };
  }

  // KNOWN LIMITATION: ties between nodes sharing the same originLeft are
  // broken by direct ID comparison. This is correct for the common case
  // but is not the full LSEQ/Logoot position-allocation scheme, which
  // handles deeper concurrent-insertion chains with more rigor. This is
  // a deliberate scope decision.
  applyInsert(node: CharNode): void {
    const insertAfterIndex = node.originLeft
      ? this.nodes.findIndex(n => idsEqual(n.id, node.originLeft))
      : -1;

    let insertAt = insertAfterIndex + 1;

    while (
      insertAt < this.nodes.length &&
      idsEqual(this.nodes[insertAt].originLeft, node.originLeft) &&
      compareIds(this.nodes[insertAt].id, node.id) < 0
    ) {
      insertAt++;
    }

    this.nodes.splice(insertAt, 0, node);
  }

  localDelete(index: number): DeleteOp {
    const visibleNodes = this.nodes.filter(n => !n.deleted);
    const target = visibleNodes[index];
    this.applyDelete(target.id);
    return { type: 'delete', id: target.id };
  }

  // KNOWN LIMITATION: if a delete arrives before its corresponding insert
  // (out-of-order delivery), this silently no-ops rather than buffering
  // and retrying. A production system would need an out-of-order op buffer.
  applyDelete(id: CharId): void {
    const node = this.nodes.find(n => idsEqual(n.id, id));
    if (node) node.deleted = true;
  }

  applyOperation(op: Operation): void {
    if (op.type === 'insert') this.applyInsert(op.node);
    else this.applyDelete(op.id);
  }

  toString(): string {
    return this.nodes.filter(n => !n.deleted).map(n => n.char).join('');
  }
}
