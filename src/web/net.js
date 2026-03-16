export function clientIp(req) {
  return String(req?.socket?.remoteAddress || "");
}

export function isLocalRequest(req) {
  const ip = clientIp(req);
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function isHttpsRequest(req) {
  const xfProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (xfProto === "https") return true;
  const xfScheme = String(req?.headers?.["x-forwarded-scheme"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (xfScheme === "https") return true;
  return Boolean(req?.socket?.encrypted);
}

