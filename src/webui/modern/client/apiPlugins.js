export function renderClientApiPlugins() {
  return `
let pluginsCache = [];

function renderPlugins() {
  const el = $("plugins");
  if (!el) return;
  el.innerHTML = "";

  const items = Array.isArray(pluginsCache) ? pluginsCache : [];
  if (items.length === 0) {
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = I.pluginsNone;
    el.appendChild(msg);
    return;
  }

  for (const p of items) {
    const row = document.createElement("div");
    row.className = "item";
    const left = document.createElement("div");
    const name = String(p?.name || p?.id || "");
    const id = String(p?.id || "");
    const ver = String(p?.version || "");
    const desc = String(p?.description || "");

    const head = document.createElement("div");
    const nameEl = document.createElement("span");
    nameEl.style.fontWeight = "750";
    nameEl.textContent = name;
    const idEl = document.createElement("span");
    idEl.className = "k";
    idEl.style.marginLeft = "10px";
    idEl.textContent = id;
    head.appendChild(nameEl);
    head.appendChild(idEl);
    if (ver) {
      const verEl = document.createElement("span");
      verEl.className = "pill";
      verEl.style.marginLeft = "10px";
      verEl.textContent = ver;
      head.appendChild(verEl);
    }
    left.appendChild(head);
    if (desc) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = desc;
      left.appendChild(meta);
    }

    const right = document.createElement("div");
    right.className = "row";
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    const enabled = Boolean(p?.enabled);
    btn.textContent = enabled ? I.pluginsDisable : I.pluginsEnable;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const res = await fetch("/api/plugins/toggle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, enabled: !enabled })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(json.error || I.errSave, false);
          return;
        }
        pluginsCache = Array.isArray(json.items) ? json.items : pluginsCache;
        renderPlugins();
        toast(I.saved, true);
      } finally {
        btn.disabled = false;
      }
    });

    right.appendChild(btn);
    row.appendChild(left);
    row.appendChild(right);
    el.appendChild(row);
  }
}

async function loadPlugins() {
  const res = await fetch("/api/plugins");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConfig, false);
    return;
  }
  const next = Array.isArray(json.items) ? json.items : [];
  try {
    const seenRaw = localStorage.getItem("seen_plugins") || "[]";
    const seen = new Set(JSON.parse(seenRaw));
    const ids = next.map((x) => String(x?.id || "")).filter(Boolean);
    const hasNew = ids.some((id) => !seen.has(id));
    if (hasNew && ids.length > 0) toast(I.pluginsNewFound, true);
    localStorage.setItem("seen_plugins", JSON.stringify(ids));
  } catch {}
  pluginsCache = next;
  renderPlugins();
}
`;
}
