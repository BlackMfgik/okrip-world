import { z } from "zod";

const snowflake = z.string().regex(/^\d{17,20}$/);
// Порожнє поле форми означає «не задано».
const blankAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const roleMessageFields = {
  channelId: snowflake,
  // Без ролі бот публікує звичайне повідомлення без кнопки.
  roleId: z.preprocess(blankAsUndefined, snowflake.optional()),
  content: z.string().trim().min(1).max(2000),
  buttonLabel: z.preprocess(
    blankAsUndefined,
    z.string().trim().max(80).optional(),
  ),
  suppressEmbeds: z.boolean().default(false),
};

const labelNeedsRole = (input: { roleId?: string; buttonLabel?: string }) =>
  Boolean(input.roleId || !input.buttonLabel);
const labelNeedsRoleError = {
  message: "Напис на кнопці потребує ID ролі.",
  path: ["roleId"],
};

export const adminDiscordRoleMessageSchema = z
  .object(roleMessageFields)
  .strict()
  .refine(labelNeedsRole, labelNeedsRoleError);

/** Редагування вже опублікованого повідомлення бота: ті самі поля плюс ID повідомлення. */
export const adminDiscordRoleMessageEditSchema = z
  .object({ ...roleMessageFields, messageId: snowflake })
  .strict()
  .refine(labelNeedsRole, labelNeedsRoleError);

export const adminDiscordMessageRefSchema = z
  .object({ channelId: snowflake, messageId: snowflake })
  .strict();

export const adminDiscordRoleMessageResultSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  roleName: z.string().optional(),
});

/** Поточний вміст повідомлення бота для форми редагування. */
export const adminDiscordRoleMessageDetailsSchema = z.object({
  messageId: z.string(),
  channelId: z.string(),
  content: z.string(),
  roleId: z.string().nullable(),
  buttonLabel: z.string().nullable(),
  suppressEmbeds: z.boolean(),
});

export type AdminDiscordRoleMessage = z.infer<
  typeof adminDiscordRoleMessageSchema
>;
export type AdminDiscordRoleMessageEdit = z.infer<
  typeof adminDiscordRoleMessageEditSchema
>;
export type AdminDiscordMessageRef = z.infer<
  typeof adminDiscordMessageRefSchema
>;
export type AdminDiscordRoleMessageDetails = z.infer<
  typeof adminDiscordRoleMessageDetailsSchema
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
