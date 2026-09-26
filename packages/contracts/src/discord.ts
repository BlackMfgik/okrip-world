import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);

export const adminDiscordRoleMessageSchema = z
  .object({
    channelId: snowflake,
    roleId: snowflake,
    content: z.string().trim().min(1).max(2000),
    buttonLabel: z.string().trim().min(1).max(80),
  })
  .strict();

export const adminDiscordRoleMessageResultSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  roleName: z.string(),
});

export type AdminDiscordRoleMessage = z.infer<
  typeof adminDiscordRoleMessageSchema
>;
