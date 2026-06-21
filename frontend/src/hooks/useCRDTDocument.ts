import { useRef, useState, useCallback } from 'react';
import { CRDTDocument } from 'crdt-core';
import type { Operation } from 'crdt-core';

export function useCRDTDocument(clientId: string) {
  const docRef = useRef(new CRDTDocument(clientId));
  const [text, setText] = useState('');

  const insertLocal = useCallback((index: number, char: string): Operation => {
    const op = docRef.current.localInsert(index, char);
    setText(docRef.current.toString());
    return op;
  }, []);

  const deleteLocal = useCallback((index: number): Operation => {
    const op = docRef.current.localDelete(index);
    setText(docRef.current.toString());
    return op;
  }, []);

  const applyRemote = useCallback((op: Operation) => {
    docRef.current.applyOperation(op);
    setText(docRef.current.toString());
  }, []);

  return { text, insertLocal, deleteLocal, applyRemote };
}
