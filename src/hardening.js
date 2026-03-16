function isLoopbackHost(host) {
  const h = String(host || "").trim().toLowerCase();
  return h === "127.0.0.1" || h === "::1" || h === "localhost" || h === "::ffff:127.0.0.1";
}

function hasFlag(s, flag) {
  const str = String(s || "");
  return str.split(/\s+/).includes(flag);
}

export function logHardeningWarnings({ logger, config }) {
  const cfg = config || {};

  try {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      logger.warn("running as root is not recommended; use a dedicated low-privilege user");
    }
  } catch {}

  const env = process.env || {};
  if (String(env.NODE_TLS_REJECT_UNAUTHORIZED || "") === "0") {
    logger.warn("NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS verification (MITM risk); unset it");
  }
  if (env.NODE_EXTRA_CA_CERTS) {
    logger.warn("NODE_EXTRA_CA_CERTS is set; outbound TLS trust store is modified (supply-chain/MITM risk)");
  }
  if (env.SSL_CERT_FILE || env.SSL_CERT_DIR) {
    logger.warn("SSL_CERT_FILE/SSL_CERT_DIR is set; outbound TLS trust store may be modified");
  }
  if (env.HTTP_PROXY || env.HTTPS_PROXY || env.ALL_PROXY) {
    logger.warn("HTTP(S)_PROXY/ALL_PROXY is set; outbound requests may be routed through a proxy");
  }
  if (env.NODE_OPTIONS) {
    if (hasFlag(env.NODE_OPTIONS, "--require") || hasFlag(env.NODE_OPTIONS, "--import")) {
      logger.warn("NODE_OPTIONS injects preload modules; ensure the host is trusted");
    }
    if (hasFlag(env.NODE_OPTIONS, "--inspect") || hasFlag(env.NODE_OPTIONS, "--inspect-brk")) {
      logger.warn("NODE_OPTIONS enables inspector; ensure it's not exposed in production");
    }
  }

  const host = cfg?.server?.host;
  if (host && !isLoopbackHost(host)) {
    logger.warn(`web server is listening on ${host}; prefer 127.0.0.1 + reverse proxy for the admin panel`);
  }
  if (cfg?.web?.cookieSecure !== true && host && !isLoopbackHost(host)) {
    logger.warn("web.cookieSecure is false while server.host is non-loopback; use HTTPS and set cookieSecure=true");
  }
  if (cfg?.telegram?.allowAll === true) {
    logger.warn("telegram.allowAll=true is risky; prefer allowlists (allowedChatIds/allowedUserIds)");
  }
  if (String(cfg?.web?.password || "") === "change_me") {
    logger.warn("web.password is still 'change_me'; change it before exposing the panel");
  }
}

