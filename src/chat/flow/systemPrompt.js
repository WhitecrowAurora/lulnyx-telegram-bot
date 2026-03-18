export function buildSystemPrompt({ promptSystem, personaSystem, userPrompt, chatInfo, rules, facts, summaryText, longTermMemory, longTermPersona }) {
  const parts = [];
  const p = String(promptSystem || "").trim();
  const persona = String(personaSystem || "").trim();
  const user = String(userPrompt || "").trim();
  const info = String(chatInfo || "").trim();
  const rs = Array.isArray(rules) ? rules.map((x) => String(x)).filter(Boolean) : [];
  const fs = Array.isArray(facts) ? facts.map((x) => String(x)).filter(Boolean) : [];
  const compressed = String(summaryText || "").trim();
  const ltm = String(longTermMemory || "").trim();
  const ltp = String(longTermPersona || "").trim();

  if (p) parts.push(p);
  if (persona) parts.push(persona);
  if (user) parts.push(`### Per-user prompt\n${user}`);
  if (info) parts.push(`### Chat info\n${info}`);
  if (rs.length) parts.push(`### Rules\n${rs.map((r) => `- ${r}`).join("\n")}`);
  if (fs.length) parts.push(`### Memory facts\n${fs.map((f) => `- ${f}`).join("\n")}`);
  if (compressed) parts.push(`### Compressed history\n${compressed}`);
  if (ltp) parts.push(`### Long-term persona\n${ltp}`);
  if (ltm) parts.push(`### Long-term memory\n${ltm}`);

  return parts.join("\n\n").trim();
}

export function buildChatInfo({ chatId, userId, chatType, chatSettings, sender }) {
  const parts = [];
  const type = String(chatType || chatSettings?.chatType || "").trim();
  if (type) parts.push(`chat_type: ${type}`);
  if ((type === "group" || type === "supergroup") && chatSettings?.title) parts.push(`chat_title: ${String(chatSettings.title)}`);
  const name = String(sender?.preferredName || "").trim() || formatSenderName(sender);
  if (name) parts.push(`user: ${name} (id ${String(userId)})`);
  else parts.push(`user_id: ${String(userId)}`);
  parts.push(`chat_id: ${String(chatId)}`);
  return parts.join("\n");
}

export function formatSenderName(sender) {
  const s = sender && typeof sender === "object" ? sender : {};
  const u = String(s.username || "").trim();
  if (u) return `@${u.replace(/^@+/, "")}`;
  const first = String(s.firstName || "").trim();
  const last = String(s.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  return full;
}
