export function renderClientApiChats() {
  return `
let knownChatsCache = [];

function renderChats() {
  const filter = String($("chatFilter")?.value || "").trim().toLowerCase();
  const el = $("chats");
  el.innerHTML = "";
  for (const c of knownChatsCache || []) {
    const chatId = String(c?.chatId || "");
    const title = String(c?.title || "");
    const username = String(c?.username || "");
    const chatType = String(c?.chatType || "");
    const hay = (chatId + " " + title + " " + username + " " + chatType).toLowerCase();
    if (filter && !hay.includes(filter)) continue;

    const row = document.createElement("div");
    row.className = "item";
    const left = document.createElement("div");
    left.innerHTML =
      '<div><span class="k">' +
      chatId +
      '</span> <span class="pill" style="margin-left:8px">' +
      chatType +
      "</span></div>" +
      '<div class="meta">' +
      (title || username || "") +
      "</div>";

    const right = document.createElement("div");
    right.className = "row";
    const btnCopy = document.createElement("button");
    btnCopy.className = "btn";
    btnCopy.type = "button";
    btnCopy.textContent = I.actionCopy;
    btnCopy.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(chatId);
          toast(I.copied, true);
          return;
        }
      } catch {}
      prompt(I.promptCopyChatId, chatId);
    });

    const btnAllow = document.createElement("button");
    btnAllow.className = "btn";
    btnAllow.type = "button";
    btnAllow.textContent = I.actionAllow;
    btnAllow.addEventListener("click", () => {
      const cur = linesToArr($("fAllowedChats").value);
      if (chatId && !cur.includes(chatId)) cur.push(chatId);
      $("fAllowedChats").value = cur.join("\\n") + (cur.length ? "\\n" : "");
      toast(I.addedAllowlist, true);
    });

    const btnAuto = document.createElement("button");
    btnAuto.className = "btn";
    btnAuto.type = "button";
    const setAutoText = () => {
      btnAuto.textContent = c && c.autoReply ? I.autoReplyOn : I.autoReplyOff;
    };
    setAutoText();
    btnAuto.addEventListener("click", async () => {
      const next = !(c && c.autoReply);
      const res = await fetch("/api/chat-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, patch: { autoReply: next } })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || I.errSave, false);
        return;
      }
      c.autoReply = next;
      setAutoText();
      toast(I.saved, true);
    });

    right.appendChild(btnCopy);
    right.appendChild(btnAllow);
    right.appendChild(btnAuto);

    row.appendChild(left);
    row.appendChild(right);
    el.appendChild(row);
  }
}

async function loadChats() {
  const res = await fetch("/api/known-chats");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadChats, false);
    return;
  }
  knownChatsCache = Array.isArray(json.items) ? json.items : [];
  renderChats();
}
`;
}

