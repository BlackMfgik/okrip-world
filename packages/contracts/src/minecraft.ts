import { z } from "zod";
import { minecraftUsernameSchema } from "./applications.js";
export const commandTypeSchema = z.enum([
  "whitelist_add",
  "whitelist_remove",
  "kick",
  "ban",
]);
export const commandPayloadSchema = z
  .object({
    username: minecraftUsernameSchema,
    reason: z.string().max(256).optional(),
  })
  .strict();
export const leaseRequestSchema = z
  .object({ limit: z.number().int().min(1).max(10).default(1) })
  .strict();
export const commandSchema = z.object({
  id: z.string().uuid(),
  leaseToken: z.string().uuid(),
  type: commandTypeSchema,
  payload: commandPayloadSchema,
});
export const leaseResponseSchema = z.object({
  commands: z.array(commandSchema),
});
export const acknowledgementSchema = z
  .object({ leaseToken: z.string().uuid() })
  .strict();
export const failureSchema = acknowledgementSchema.extend({
  error: z.enum(["execution_failed", "local_ban"]),
});
export const banEventSchema = z
  .object({
    eventId: z.string().uuid(),
    username: minecraftUsernameSchema,
    reason: z.string().min(1).max(256),
  })
  .strict();
export type MinecraftCommand = z.infer<typeof commandSchema>;
