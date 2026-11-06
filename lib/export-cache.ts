// Cache em memória, limitado por tamanho e tempo. A autorização ocorre antes da consulta.
export function createExportCache(maxBytes = 24 * 1024 * 1024, ttlMs = 5 * 60 * 1000) {
  const entries = new Map<string, { bytes: Uint8Array; expires: number }>();
  const pending = new Map<string, Promise<Uint8Array>>();
  let size = 0;
  function remove(key: string) {
    const item = entries.get(key);
    if (item) { size -= item.bytes.byteLength; entries.delete(key); }
  }
  return async (key: string, render: () => Promise<Uint8Array>) => {
    for (const [id, entry] of entries) if (entry.expires <= Date.now()) remove(id);
    const cached = entries.get(key);
    if (cached) return cached.bytes;
    const existing = pending.get(key);
    if (existing) return existing;
    const work = Promise.resolve().then(render).then(bytes => {
      if (bytes.byteLength <= maxBytes) {
        while (size + bytes.byteLength > maxBytes && entries.size) remove(entries.keys().next().value!);
        entries.set(key, { bytes, expires: Date.now() + ttlMs });
        size += bytes.byteLength;
      }
      return bytes;
    }).finally(() => pending.delete(key));
    pending.set(key, work);
    return work;
  };
}
