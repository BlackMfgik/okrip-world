export function discordAvatarUrl(discordId: string, avatar: string | null) {
  if (!avatar) return null;
  const extension = avatar.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(discordId)}/${encodeURIComponent(avatar)}.${extension}?size=64`;
}
