export { authService, type AuthService } from "./auth.service.js";
export { authRoutes } from "./auth.routes.js";
export {
  discordProvider,
  type DiscordProvider,
  type DiscordIdentity,
  type DiscordMembership,
} from "./discord.service.js";
export { saveDiscordMembership } from "./auth.repository.js";
export { discordMembershipEnricher } from "./discord-membership.service.js";
