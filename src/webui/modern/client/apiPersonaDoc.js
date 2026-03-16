export function renderClientApiPersonaDoc() {
  return `
async function loadManualPersona() {
  const res = await fetch("/api/bot-doc?key=" + encodeURIComponent("persona_manual"));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConfig, false);
    return;
  }
  $("fManualPersona").value = json.doc && json.doc.value ? String(json.doc.value) : "";
}

async function saveManualPersona() {
  const value = String($("fManualPersona").value || "");
  const res = await fetch("/api/bot-doc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "persona_manual", value })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    toast(json.error || I.errSave, false);
    return;
  }
  toast(I.saved, true);
}
`;
}

