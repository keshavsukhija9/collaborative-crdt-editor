export interface CharId {
  clientId: string;
  clock: number;
}

export interface CharNode {
  id: CharId;
  char: string;
  originLeft: CharId | null;
  deleted: boolean;
}

export interface InsertOp {
  type: 'insert';
  node: CharNode;
}

export interface DeleteOp {
  type: 'delete';
  id: CharId;
}

export type Operation = InsertOp | DeleteOp;
