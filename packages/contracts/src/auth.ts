import { z } from "zod";
export const sessionSchema = z.object({
  user: z
    .object({
      username: z.string(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().url().nullable(),
      isAdmin: z.boolean(),
      canManageAdmins: z.boolean(),
      isSuperAdmin: z.boolean(),
      // Необов'язкове, поки старий API ще може відповідати без нього.
      canManageDiscord: z.boolean().optional(),
    })
    .nullable(),
});
export type Session = z.infer<typeof sessionSchema>;
