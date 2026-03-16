export function renderClientApiSearch() {
  return `
async function doSearch() {
  const q = $("q").value;
  const res = await fetch("/api/search-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q })
  });
  const json = await res.json().catch(() => ({}));
  const out = $("searchOut");
  out.innerHTML = "";
  if (!res.ok) {
    toast(json.error || I.errSearch, false);
    return;
  }
  const items = json.results || [];
  if (!items.length) {
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = I.noResults;
    out.appendChild(msg);
    return;
  }
  for (const r of items) {
    const d = document.createElement("div");
    d.className = "item";
    const left = document.createElement("div");
    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = r.title || r.url;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (r.engine || "") + (r.content ? " · " + r.content.slice(0, 120) : "");
    left.appendChild(a);
    left.appendChild(meta);
    d.appendChild(left);
    out.appendChild(d);
  }
}
`;
}

