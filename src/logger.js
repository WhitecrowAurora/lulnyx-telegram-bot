export function createLogger() {
  const fmt = (level, msg, extra) => {
    const ts = new Date().toISOString();
    if (extra instanceof Error) return `[${ts}] ${level} ${msg} ${extra.stack || extra.message}`;
    if (extra !== undefined) return `[${ts}] ${level} ${msg} ${safeStringify(extra)}`;
    return `[${ts}] ${level} ${msg}`;
  };

  return {
    info: (msg, extra) => console.log(fmt("INFO", msg, extra)),
    warn: (msg, extra) => console.warn(fmt("WARN", msg, extra)),
    error: (msg, extra) => console.error(fmt("ERROR", msg, extra))
  };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

