export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  const w = Number(windowMs || 60_000);
  const m = Number(max || 20);
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits.entries()) {
      if (!v || now - v.startAt > w) hits.delete(k);
    }
  }, Math.min(w, 60_000)).unref?.();
  return {
    allow(key) {
      const k = String(key || "unknown");
      const now = Date.now();
      const cur = hits.get(k);
      if (!cur || now - cur.startAt > w) {
        hits.set(k, { startAt: now, n: 1 });
        return true;
      }
      cur.n += 1;
      return cur.n <= m;
    }
  };
}

