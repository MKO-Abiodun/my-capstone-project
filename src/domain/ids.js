import { randomUUID } from 'node:crypto';

export function newId() {
  return randomUUID();
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I O 0 1

export function newReference() {
  let ref = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ALPHABET.length);
    ref += ALPHABET[idx];
  }
  return ref;
}

// Alias for benchmark script that expects newReferenceCode
export const newReferenceCode = newReference;
