export async function readJson(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function sendJson(res, status, obj) {
  const body = Buffer.from(`${JSON.stringify(obj)}\n`);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", String(body.length));
  res.end(body);
}

export function sendHtml(res, status, html) {
  const body = Buffer.from(String(html || ""), "utf8");
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("content-length", String(body.length));
  res.end(body);
}

export function sendText(res, status, text) {
  const body = Buffer.from(String(text || ""), "utf8");
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("content-length", String(body.length));
  res.end(body);
}

export function redirect(res, to) {
  res.statusCode = 302;
  res.setHeader("Location", String(to || "/"));
  res.end();
}

