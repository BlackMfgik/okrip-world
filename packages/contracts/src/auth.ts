import { z } from "zod";
export const sessionSchema = z.object({
  user: z
    .object({ username: z.string(), displayName: z.string().nullable() })
    .nullable(),
});
export type Session = z.infer<typeof sessionSchema>;
