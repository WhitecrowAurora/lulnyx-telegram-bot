export function renderClientApiSummary() {
  return `
async function loadSummary() {
  const out = $("summaryOut");
  if (out) out.value = "";
  const res = await fetch("/api/config-summary");
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    toast(json.error || I.errLoadConfig, false);
    return;
  }
  const s = json.summary || {};
  if (out) out.value = JSON.stringify(s, null, 2) + "\\n";
}
`;
}

