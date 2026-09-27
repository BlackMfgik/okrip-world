/** Єдиний Discord ID з повними правами: розділ Discord і видалення будь-кого з адмінів, крім себе. */
export const SUPER_ADMIN_DISCORD_ID = "554465791358140417";
export const isSuperAdmin = (discordId: string) =>
  discordId === SUPER_ADMIN_DISCORD_ID;
