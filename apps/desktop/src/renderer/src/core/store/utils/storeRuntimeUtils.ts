export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createId(prefix: string): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto !== 'undefined' && typeof webCrypto.randomUUID === 'function') {
    return `${prefix}_${webCrypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
