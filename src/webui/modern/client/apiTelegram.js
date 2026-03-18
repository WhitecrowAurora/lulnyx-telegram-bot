export function renderClientApiTelegram() {
  return `
async function loadTelegramStatus() {
  const out = $("tgStatusOut");
  if (!out) return;
  const res = await fetch("/api/telegram/status");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errTelegramStatus, false);
    return null;
  }
  out.value = JSON.stringify(json.status, null, 2) + "\\n";
  toast(I.telegramStatusLoaded, true);
  return json.status;
}
`;
}

