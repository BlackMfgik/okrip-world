import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
// Порожнє поле форми означає «не задано».
const blankAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const adminDiscordRoleMessageSchema = z
  .object({
    channelId: snowflake,
    // Без ролі бот публікує звичайне повідомлення без кнопки.
    roleId: z.preprocess(blankAsUndefined, snowflake.optional()),
    content: z.string().trim().min(1).max(2000),
    buttonLabel: z.preprocess(
      blankAsUndefined,
      z.string().trim().max(80).optional(),
    ),
    suppressEmbeds: z.boolean().default(false),
  })
  .strict()
  .refine((input) => input.roleId || !input.buttonLabel, {
    message: "Напис на кнопці потребує ID ролі.",
    path: ["roleId"],
  });

export const adminDiscordRoleMessageResultSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  roleName: z.string().optional(),
});

export type AdminDiscordRoleMessage = z.infer<
  typeof adminDiscordRoleMessageSchema
>;

export const adminDiscordOptionsSchema = z.object({
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string().nullable(),
    }),
  ),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type AdminDiscordOptions = z.infer<typeof adminDiscordOptionsSchema>;
