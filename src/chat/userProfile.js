export function formatUserFullName({ firstName, lastName }) {
  return [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ").trim();
}

export function resolveModelFacingUserLabel({ profile } = {}) {
  return String(profile?.customDisplayName || "").trim();
}

export function resolvePreferredUserLabel({ sender, profile, withAt = true } = {}) {
  const mode = String(profile?.displayNameMode || "username").trim().toLowerCase();
  const custom = String(profile?.customDisplayName || "").trim();
  const username = String(sender?.username || profile?.username || "").trim().replace(/^@+/, "");
  const fullName = formatUserFullName({
    firstName: sender?.firstName ?? profile?.firstName,
    lastName: sender?.lastName ?? profile?.lastName
  });

  if (mode === "custom" && custom) return custom;
  if (username) return withAt ? `@${username}` : username;
  if (custom) return custom;
  return fullName;
}
