export function renderClientApiChats() {
  return `
let knownChatsCache = [];

function makePill(text) {
  const el = document.createElement("span");
  el.className = "pill";
  el.textContent = text;
  return el;
}

function formatLastSeen(ts) {
  const ms = Number(ts || 0);
  if (!Number.isFinite(ms) || ms <= 0) return I.timeNever;
  const date = new Date(ms);
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatReplyLimit(limit) {
  const value = Number(limit || 0);
  return Number.isFinite(value) && value > 0 ? String(Math.trunc(value)) : I.labelUnlimited;
}

function formatGlobalPersonaMode(mode, enabled) {
  if (!enabled) return I.globalPersonaOff;
  const value = String(mode || "single");
  if (value === "sequential") return I.globalPersonaModeSequential;
  if (value === "random") return I.globalPersonaModeRandom;
  return I.globalPersonaModeSingle;
}

function renderChats() {
  const filter = String($("chatFilter")?.value || "").trim().toLowerCase();
  const el = $("chats");
  el.innerHTML = "";
  el.className = "chat-list";
  for (const c of knownChatsCache || []) {
    const chatId = String(c?.chatId || "");
    const title = String(c?.title || "");
    const username = String(c?.username || "");
    const chatType = String(c?.chatType || "");
    const replyStyle = String(c?.replyStyle || "");
    const replyStyleEffective = String(c?.replyStyleEffective || "reply_and_mention");
    const providerName = String(c?.providerNameEffective || c?.providerEffective || "").trim() || I.labelNotConfigured;
    const providerInherited = c?.providerInherited === true;
    const lastSeenText = formatLastSeen(c?.lastSeenAt);
    const globalPersonaEnabled = c?.globalPersonaEnabled === true;
    const globalPersonaMode = String(c?.globalPersonaMode || "single");
    const globalPersonaOwnerId = String(c?.globalPersonaUserId || "");
    const globalPersonaOwnerDisplay = String(c?.globalPersonaOwnerDisplay || globalPersonaOwnerId || "").trim();
    const globalPersonaReplyCount = Number(c?.globalPersonaReplyCount || 0);
    const globalPersonaReplyLimit = Number(c?.globalPersonaReplyLimit || 0);
    const globalPersonaQueueCount = Number(c?.globalPersonaQueueCount || 0);
    const globalPersonaNextOwnerDisplay = String(c?.globalPersonaNextOwnerDisplay || "").trim();
    const replyStyleLabel =
      replyStyleEffective === "reply_only"
        ? I.labelReplyOnly
        : replyStyleEffective === "mention_only"
          ? I.labelMentionOnly
          : I.labelReplyAndMention;
    const hay = (chatId + " " + title + " " + username + " " + chatType + " " + providerName).toLowerCase();
    if (filter && !hay.includes(filter)) continue;

    const row = document.createElement("div");
    row.className = "chat-card";
    const left = document.createElement("div");
    left.className = "chat-main";

    const titleRow = document.createElement("div");
    titleRow.className = "chat-title";
    const idEl = document.createElement("span");
    idEl.className = "k";
    idEl.textContent = chatId;
    const typeEl = document.createElement("span");
    typeEl.className = "pill";
    typeEl.textContent = chatType;
    titleRow.appendChild(idEl);
    titleRow.appendChild(typeEl);
    left.appendChild(titleRow);

    const nameEl = document.createElement("div");
    nameEl.className = "chat-name";
    nameEl.textContent = title || username || chatId;
    left.appendChild(nameEl);

    const subEl = document.createElement("div");
    subEl.className = "chat-sub";
    subEl.textContent = username && title ? "@" + username : username ? "@" + username : "";
    left.appendChild(subEl);

    const tags = document.createElement("div");
    tags.className = "chat-tags";
    tags.appendChild(makePill(replyStyleLabel + (replyStyle ? "" : " · " + I.labelReplyStyleDefault)));
    tags.appendChild(makePill(c && c.autoReply ? I.autoReplyOn : I.autoReplyOff));
    tags.appendChild(
      makePill(
        formatGlobalPersonaMode(globalPersonaMode, globalPersonaEnabled) +
          (globalPersonaEnabled && globalPersonaMode === "single" && globalPersonaOwnerDisplay ? " · " + globalPersonaOwnerDisplay : "")
      )
    );
    if (globalPersonaEnabled && globalPersonaMode === "single") {
      tags.appendChild(makePill(I.globalPersonaQuota + ": " + globalPersonaReplyCount + "/" + formatReplyLimit(globalPersonaReplyLimit)));
    }
    if (globalPersonaEnabled && globalPersonaMode !== "single") {
      tags.appendChild(makePill(I.globalPersonaQueue + ": " + globalPersonaQueueCount));
      if (globalPersonaNextOwnerDisplay) tags.appendChild(makePill(I.globalPersonaNext + ": " + globalPersonaNextOwnerDisplay));
    }
    tags.appendChild(makePill(I.labelProviderCurrent + ": " + providerName + (providerInherited ? " · " + I.labelReplyStyleDefault : "")));
    tags.appendChild(makePill(I.labelLastActive + ": " + lastSeenText));
    left.appendChild(tags);

    const right = document.createElement("div");
    right.className = "chat-actions";

    const rowTop = document.createElement("div");
    rowTop.className = "row";
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

    const styleWrap = document.createElement("div");
    styleWrap.className = "row";
    const styleSel = document.createElement("select");
    styleSel.className = "input";
    styleSel.style.minWidth = "190px";
    styleSel.innerHTML =
      '<option value="">' +
      I.labelReplyStyleDefault +
      '</option><option value="reply_only">' +
      I.labelReplyOnly +
      '</option><option value="reply_and_mention">' +
      I.labelReplyAndMention +
      '</option><option value="mention_only">' +
      I.labelMentionOnly +
      "</option>";
    styleSel.value = replyStyle;

    const btnStyle = document.createElement("button");
    btnStyle.className = "btn";
    btnStyle.type = "button";
    btnStyle.textContent = I.actionApply;
    btnStyle.addEventListener("click", async () => {
      const next = String(styleSel.value || "");
      const res = await fetch("/api/chat-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, patch: { replyStyle: next } })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || I.errSave, false);
        return;
      }
      c.replyStyle = next;
      c.replyStyleEffective = String(json?.settings?.replyStyleEffective || c.replyStyleEffective || "reply_and_mention");
      renderChats();
      toast(I.saved, true);
    });
    styleWrap.appendChild(styleSel);
    styleWrap.appendChild(btnStyle);

    const personaWrap = document.createElement("div");
    personaWrap.className = "row";
    const personaSel = document.createElement("select");
    personaSel.className = "input";
    personaSel.style.minWidth = "180px";
    personaSel.innerHTML =
      '<option value="off">' +
      I.globalPersonaOff +
      '</option><option value="single">' +
      I.globalPersonaModeSingle +
      '</option><option value="sequential">' +
      I.globalPersonaModeSequential +
      '</option><option value="random">' +
      I.globalPersonaModeRandom +
      "</option>";
    personaSel.value = globalPersonaEnabled ? globalPersonaMode : "off";

    const ownerInput = document.createElement("input");
    ownerInput.className = "input";
    ownerInput.style.minWidth = "150px";
    ownerInput.placeholder = I.fieldGlobalPersonaUserId;
    ownerInput.value = globalPersonaOwnerId;

    const limitInput = document.createElement("input");
    limitInput.className = "input";
    limitInput.type = "number";
    limitInput.min = "0";
    limitInput.step = "1";
    limitInput.style.width = "110px";
    limitInput.value = String(Number.isFinite(globalPersonaReplyLimit) ? globalPersonaReplyLimit : 100);

    const syncPersonaControls = () => {
      const singleMode = personaSel.value === "single";
      ownerInput.disabled = !singleMode;
      limitInput.disabled = !singleMode;
    };
    syncPersonaControls();
    personaSel.addEventListener("change", syncPersonaControls);

    const btnPersona = document.createElement("button");
    btnPersona.className = "btn";
    btnPersona.type = "button";
    btnPersona.textContent = I.actionApply;
    btnPersona.addEventListener("click", async () => {
      const selectedMode = String(personaSel.value || "off");
      const nextEnabled = selectedMode !== "off";
      const nextMode = nextEnabled ? selectedMode : globalPersonaMode || "single";
      const nextOwner = String(ownerInput.value || "").trim();
      const nextLimit = Math.max(0, Math.trunc(Number(limitInput.value || 0) || 0));
      const res = await fetch("/api/chat-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chatId,
          patch: {
            globalPersonaEnabled: nextEnabled,
            globalPersonaMode: nextMode,
            globalPersonaUserId: nextOwner,
            globalPersonaReplyLimit: nextLimit
          }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || I.errSave, false);
        return;
      }
      Object.assign(c, json?.settings || {});
      renderChats();
      toast(I.saved, true);
    });

    const btnResetPersonaCount = document.createElement("button");
    btnResetPersonaCount.className = "btn";
    btnResetPersonaCount.type = "button";
    btnResetPersonaCount.textContent = I.actionResetCount;
    btnResetPersonaCount.addEventListener("click", async () => {
      const res = await fetch("/api/chat-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, patch: { resetGlobalPersonaReplyCount: true } })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || I.errSave, false);
        return;
      }
      Object.assign(c, json?.settings || {});
      renderChats();
      toast(I.saved, true);
    });
    personaWrap.appendChild(personaSel);
    personaWrap.appendChild(ownerInput);
    personaWrap.appendChild(limitInput);
    personaWrap.appendChild(btnPersona);
    personaWrap.appendChild(btnResetPersonaCount);

    rowTop.appendChild(btnCopy);
    rowTop.appendChild(btnAllow);
    rowTop.appendChild(btnAuto);
    right.appendChild(rowTop);
    right.appendChild(styleWrap);
    right.appendChild(personaWrap);

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
