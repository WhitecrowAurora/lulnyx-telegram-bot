export function createLogger() {
  const maxLines = 2000;
  const ring = [];
  const push = (line) => {
    ring.push(String(line || ""));
    while (ring.length > maxLines) ring.shift();
  };

  const fmt = (level, msg, extra) => {
    const ts = new Date().toISOString();
    if (extra instanceof Error) return `[${ts}] ${level} ${msg} ${extra.stack || extra.message}`;
    if (extra !== undefined) return `[${ts}] ${level} ${msg} ${safeStringify(extra)}`;
    return `[${ts}] ${level} ${msg}`;
  };

  return {
    info: (msg, extra) => {
      const line = fmt("INFO", msg, extra);
      push(line);
      console.log(line);
    },
    warn: (msg, extra) => {
      const line = fmt("WARN", msg, extra);
      push(line);
      console.warn(line);
    },
    error: (msg, extra) => {
      const line = fmt("ERROR", msg, extra);
      push(line);
      console.error(line);
    },
    tail: (limit = 400) => {
      const n = Number(limit ?? 400);
      const size = Number.isFinite(n) ? Math.max(0, Math.min(5000, Math.trunc(n))) : 400;
      if (size === 0) return [];
      return ring.slice(-size);
    }
  };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
