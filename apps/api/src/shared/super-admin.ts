/** Єдиний Discord ID з повними правами: розділ Discord і видалення будь-кого з адмінів, крім себе. */
export const SUPER_ADMIN_DISCORD_ID = "554465791358140417";
export const isSuperAdmin = (discordId: string) =>
  discordId === SUPER_ADMIN_DISCORD_ID;

/** Власник сервера (додано міграцією 0014): має доступ до розділу Discord, але не прав суперадміна. */
export const OWNER_DISCORD_ID = "302714744626741248";
export const canManageDiscord = (discordId: string) =>
  isSuperAdmin(discordId) || discordId === OWNER_DISCORD_ID;
