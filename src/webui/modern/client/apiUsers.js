export function renderClientApiUsers() {
  return `
let userProfilesCache = [];

function userPromptSlotLabel(slot) {
  const s = String(slot || "");
  if (s === "slot1") return I.usersPromptSlot1;
  if (s === "slot2") return I.usersPromptSlot2;
  return I.usersPromptOff;
}

function userFullName(u) {
  return [String(u?.firstName || "").trim(), String(u?.lastName || "").trim()].filter(Boolean).join(" ").trim();
}

function renderUsers() {
  const filter = String($("userFilter")?.value || "").trim().toLowerCase();
  const el = $("users");
  if (!el) return;
  el.innerHTML = "";
  el.className = "chat-list";

  const items = userProfilesCache || [];
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "msg";
    empty.textContent = I.usersNoProfiles;
    el.appendChild(empty);
    return;
  }

  for (const u of items) {
    const userId = String(u?.userId || "");
    const username = String(u?.username || "");
    const fullName = userFullName(u);
    const customName = String(u?.customDisplayName || "");
    const hay = (userId + " " + username + " " + fullName + " " + customName).toLowerCase();
    if (filter && !hay.includes(filter)) continue;

    const card = document.createElement("div");
    card.className = "chat-card";
    const left = document.createElement("div");
    left.className = "chat-main";

    const titleRow = document.createElement("div");
    titleRow.className = "chat-title";
    titleRow.appendChild(makePill(I.labelUserId + ": " + userId));
    if (username) titleRow.appendChild(makePill(I.labelUsername + ": @" + username));
    left.appendChild(titleRow);

    const nameEl = document.createElement("div");
    nameEl.className = "chat-name";
    nameEl.textContent = customName || fullName || (username ? "@" + username : userId);
    left.appendChild(nameEl);

    const subEl = document.createElement("div");
    subEl.className = "chat-sub";
    subEl.textContent = fullName ? I.labelFullName + ": " + fullName : "";
    left.appendChild(subEl);

    const tags = document.createElement("div");
    tags.className = "chat-tags";
    tags.appendChild(makePill((u?.displayNameMode === "custom" ? I.usersModeCustom : I.usersModeUsername)));
    tags.appendChild(makePill(I.labelLastActive + ": " + formatLastSeen(u?.lastSeenAt)));
    tags.appendChild(makePill(I.fieldActiveCustomPrompt + ": " + userPromptSlotLabel(u?.activePromptSlot)));
    if (u?.hasPrompt1) tags.appendChild(makePill(I.usersPromptSlot1));
    if (u?.hasPrompt2) tags.appendChild(makePill(I.usersPromptSlot2));
    left.appendChild(tags);

    const right = document.createElement("div");
    right.className = "chat-actions";

    const modeSel = document.createElement("select");
    modeSel.className = "input";
    modeSel.innerHTML =
      '<option value="username">' + I.usersModeUsername + "</option>" +
      '<option value="custom">' + I.usersModeCustom + "</option>";
    modeSel.value = String(u?.displayNameMode || "username");

    const customInput = document.createElement("input");
    customInput.className = "input";
    customInput.value = customName;
    customInput.placeholder = I.labelName;

    const promptSel = document.createElement("select");
    promptSel.className = "input";
    promptSel.innerHTML =
      '<option value="">' + I.usersPromptOff + "</option>" +
      '<option value="slot1">' + I.usersPromptSlot1 + "</option>" +
      '<option value="slot2">' + I.usersPromptSlot2 + "</option>";
    promptSel.value = String(u?.activePromptSlot || "");

    const prompt1 = document.createElement("textarea");
    prompt1.className = "input";
    prompt1.style.minHeight = "120px";
    prompt1.value = String(u?.customPrompt1 || "");

    const prompt2 = document.createElement("textarea");
    prompt2.className = "input";
    prompt2.style.minHeight = "120px";
    prompt2.value = String(u?.customPrompt2 || "");

    const btnSave = document.createElement("button");
    btnSave.className = "btn primary";
    btnSave.type = "button";
    btnSave.textContent = I.actionSave || "Save";
    btnSave.addEventListener("click", async () => {
      const res = await fetch("/api/user-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          patch: {
            displayNameMode: modeSel.value,
            customDisplayName: customInput.value,
            activePromptSlot: promptSel.value,
            customPrompt1: prompt1.value,
            customPrompt2: prompt2.value
          }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || I.errSave, false);
        return;
      }
      const p = json?.profile || {};
      u.displayNameMode = String(p.displayNameMode || modeSel.value || "username");
      u.customDisplayName = String(p.customDisplayName || "");
      u.activePromptSlot = String(p.activePromptSlot || "");
      u.customPrompt1 = String(p.customPrompt1 || "");
      u.customPrompt2 = String(p.customPrompt2 || "");
      u.hasPrompt1 = Boolean(String(u.customPrompt1 || "").trim());
      u.hasPrompt2 = Boolean(String(u.customPrompt2 || "").trim());
      renderUsers();
      toast(I.userProfileSaved, true);
    });

    const fields = [
      [I.fieldDisplayNameMode || "Display name mode", modeSel],
      [I.fieldCustomDisplayName || "Custom display name", customInput],
      [I.fieldActiveCustomPrompt || "Active custom prompt", promptSel],
      [I.fieldCustomPrompt1 || "Custom prompt 1", prompt1],
      [I.fieldCustomPrompt2 || "Custom prompt 2", prompt2]
    ];
    for (const pair of fields) {
      const wrap = document.createElement("div");
      const label = document.createElement("label");
      label.textContent = pair[0];
      wrap.appendChild(label);
      wrap.appendChild(pair[1]);
      right.appendChild(wrap);
    }
    right.appendChild(btnSave);

    card.appendChild(left);
    card.appendChild(right);
    el.appendChild(card);
  }
}

async function loadUsers() {
  const res = await fetch("/api/user-profiles");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(json.error || I.errLoadUsers, false);
    return;
  }
  userProfilesCache = Array.isArray(json.items) ? json.items : [];
  renderUsers();
}
`;
}
