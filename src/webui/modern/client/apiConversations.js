export function renderClientApiConversations() {
  return `
let convKeysCache = [];

function renderConvList() {
  const filter = String($("convFilter")?.value || "").trim().toLowerCase();
  const el = $("convList");
  el.innerHTML = "";
  for (const k of convKeysCache || []) {
    const ks = String(k || "");
    if (filter && !ks.toLowerCase().includes(filter)) continue;
    const row = document.createElement("div");
    row.className = "item";
    const left = document.createElement("div");
    left.innerHTML = '<div class="k">' + ks + '</div><div class="meta">' + I.metaClickToOpen + "</div>";
    row.appendChild(left);
    row.addEventListener("click", () => openConversation(ks));
    el.appendChild(row);
  }
}

async function refreshConvList() {
  const res = await fetch("/api/conversations");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errListConversations, false);
    return;
  }
  convKeysCache = Array.isArray(json.keys) ? json.keys : [];
  renderConvList();
}

async function openConversation(key) {
  const res = await fetch("/api/conversation?key=" + encodeURIComponent(key));
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadConversation, false);
    return;
  }
  $("convKey").value = String(key);
  $("convJson").value = JSON.stringify(json.conversation, null, 2) + "\\n";
  $("btnConvSave").disabled = false;
  $("btnConvDelete").disabled = false;
}

async function saveConversation() {
  const key = $("convKey").value;
  if (!key) {
    toast(I.noConversationSelected, false);
    return;
  }
  let conv = null;
  try {
    conv = JSON.parse($("convJson").value);
  } catch {
    toast(I.conversationJsonParse, false);
    return;
  }
  const res = await fetch("/api/conversation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, conversation: conv })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errSave, false);
    return;
  }
  toast(I.saved, true);
}

async function deleteConversation() {
  const key = $("convKey").value;
  if (!key) {
    toast(I.noConversationSelected, false);
    return;
  }
  if (!confirm(I.confirmDeleteConversation)) return;
  const res = await fetch("/api/conversation", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errDelete, false);
    return;
  }
  $("convKey").value = "";
  $("convJson").value = "";
  $("btnConvSave").disabled = true;
  $("btnConvDelete").disabled = true;
  await refreshConvList();
  toast(I.deleted, true);
}
`;
}

