export function renderClientApiDaily() {
  return `
let dailyDaysCache = [];

async function loadDailyDays() {
  const res = await fetch("/api/daily-days?limit=60");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConfig, false);
    return;
  }
  dailyDaysCache = Array.isArray(json.days) ? json.days : [];
  renderDailyDays();
}

function renderDailyDays() {
  const el = $("dailyDays");
  if (!el) return;
  el.innerHTML = "";
  for (const d of dailyDaysCache || []) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = '<div class="k">' + String(d) + '</div><div class="meta">' + I.metaClickToOpen + "</div>";
    row.addEventListener("click", () => openDailyDay(String(d)));
    el.appendChild(row);
  }
}

async function openDailyDay(day) {
  const out = $("dailyOut");
  if (out) out.textContent = "";
  const res = await fetch("/api/daily-summaries?day=" + encodeURIComponent(day));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConfig, false);
    return;
  }
  const items = Array.isArray(json.items) ? json.items : [];
  const wrap = [];
  wrap.push("DAY: " + day);
  wrap.push("");
  for (const it of items) {
    wrap.push("== " + String(it.convKey || "") + " ==");
    const mem = String(it.memoryText || "").trim();
    const per = String(it.personaText || "").trim();
    if (mem) wrap.push("[memory]\\n" + mem);
    if (per) wrap.push("\\n[persona]\\n" + per);
    wrap.push("");
  }
  if (out) out.textContent = wrap.join("\\n");
}
`;
}

