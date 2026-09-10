import { z } from "zod";
export const minecraftUsernameSchema = z.string().regex(/^[A-Za-z0-9_]{3,16}$/);
export const submitApplicationSchema = z
  .object({ minecraftUsername: minecraftUsernameSchema })
  .strict();
export const applicationStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const accessStatusSchema = z.enum(["active", "revoked", "banned"]);
export const currentApplicationSchema = z.object({
  application: z
    .object({
      publicId: z.string(),
      minecraftUsername: minecraftUsernameSchema,
      status: applicationStatusSchema,
      rejectionReason: z.string().nullable(),
    })
    .nullable(),
  access: accessStatusSchema.nullable(),
  synchronization: z.enum(["waiting", "completed"]).nullable(),
});
export type CurrentApplication = z.infer<typeof currentApplicationSchema>;
export type SubmitApplication = z.infer<typeof submitApplicationSchema>;
