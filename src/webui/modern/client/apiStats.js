export function renderClientApiStats() {
  return `
async function loadStats() {
  const out = $("statsOut");
  if (out) out.innerHTML = "";
  const res = await fetch("/api/stats?days=30");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConfig, false);
    return;
  }
  const total = json.total || {};
  const byDay = Array.isArray(json.byDay) ? json.byDay : [];
  const wrap = document.createElement("div");
  wrap.innerHTML =
    '<div class="row" style="gap:10px;flex-wrap:wrap">' +
    '<span class="pill">chars_in: ' +
    Number(total.charsIn || 0) +
    "</span>" +
    '<span class="pill">chars_out: ' +
    Number(total.charsOut || 0) +
    "</span>" +
    '<span class="pill">tokens_in: ' +
    Number(total.tokensIn || 0) +
    "</span>" +
    '<span class="pill">tokens_out: ' +
    Number(total.tokensOut || 0) +
    "</span>" +
    '<span class="pill">replies: ' +
    Number(total.replies || 0) +
    "</span>" +
    '<span class="pill">requests: ' +
    Number(total.requests || 0) +
    "</span>" +
    "</div>";
  const table = document.createElement("div");
  table.style.marginTop = "12px";
  for (const r of byDay) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML =
      '<div><div class="k">' +
      String(r.day || "") +
      '</div><div class="meta">chars_in ' +
      Number(r.charsIn || 0) +
      " · chars_out " +
      Number(r.charsOut || 0) +
      " · tokens_in " +
      Number(r.tokensIn || 0) +
      " · tokens_out " +
      Number(r.tokensOut || 0) +
      "</div></div>" +
      '<div class="meta">replies ' +
      Number(r.replies || 0) +
      " · requests " +
      Number(r.requests || 0) +
      "</div>";
    table.appendChild(row);
  }
  wrap.appendChild(table);
  out.appendChild(wrap);
}
`;
}

