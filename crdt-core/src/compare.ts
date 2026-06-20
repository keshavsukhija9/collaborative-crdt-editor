import { CharId } from './types';

export function compareIds(a: CharId, b: CharId): number {
  if (a.clock !== b.clock) return a.clock - b.clock;
  return a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0;
}

export function idsEqual(a: CharId | null, b: CharId | null): boolean {
  if (a === null || b === null) return a === b;
  return a.clientId === b.clientId && a.clock === b.clock;
}
