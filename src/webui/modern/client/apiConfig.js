export function renderClientApiConfig() {
  return `
async function loadConfig() {
  const res = await fetch("/api/config");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConfig, false);
    return null;
  }
  $("cfg").value = JSON.stringify(json.config, null, 2) + "\\n";
  renderForm(json.config);
  return json.config;
}

async function reloadConfig() {
  const res = await fetch("/api/reload", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errReload, false);
    return null;
  }
  $("cfg").value = JSON.stringify(json.config, null, 2) + "\\n";
  renderForm(json.config);
  toast(I.reloaded, true);
  return json.config;
}

async function saveConfig() {
  let obj = null;
  const rawActive = getActiveView() === "advanced-raw";
  if (rawActive) {
    try {
      obj = JSON.parse($("cfg").value);
    } catch {
      toast(I.cfgJsonParse, false);
      return;
    }
  } else {
    try {
      obj = gatherFormConfig();
    } catch (e) {
      toast(String(e?.message || "Form error"), false);
      return;
    }
  }
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config: obj })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errSave, false);
    return;
  }
  $("cfg").value = JSON.stringify(json.config, null, 2) + "\\n";
  renderForm(json.config);
  toast(I.saved, true);
}
`;
}

