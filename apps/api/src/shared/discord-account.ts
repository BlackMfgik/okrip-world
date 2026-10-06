const DISCORD_EPOCH_MS = 1420070400000n;
const MAX_SNOWFLAKE = (1n << 64n) - 1n;

export function discordAccountCreatedAt(discordId: string): string | null {
  if (!/^\d{1,20}$/.test(discordId)) return null;
  const id = BigInt(discordId);
  if (id === 0n || id > MAX_SNOWFLAKE) return null;
  return new Date(Number((id >> 22n) + DISCORD_EPOCH_MS)).toISOString();
}
