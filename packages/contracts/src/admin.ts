import { z } from "zod";
import {
  accessStatusSchema,
  applicationStatusSchema,
  minecraftUsernameSchema,
} from "./applications.js";

export const adminApplicationFilterSchema = z.enum([
  "all",
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const adminApplicationSchema = z.object({
  publicId: z.string(),
  number: z.number().int().positive(),
  discordUsername: z.string(),
  discordDisplayName: z.string().nullable(),
  minecraftUsername: z.string(),
  status: applicationStatusSchema,
  rejectionReason: z.string().nullable(),
  reviewerName: z.string().nullable(),
  createdAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
});

export const adminApplicationListSchema = z.object({
  applications: z.array(adminApplicationSchema),
  counts: z.object({
    all: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
});

export const adminDecisionSchema = z
  .object({
    publicId: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
    action: z.enum(["approve", "reject"]),
    rejectionReason: z.string().trim().min(1).max(256).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "reject" && !value.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Вкажіть причину відмови.",
      });
    }
  });

export const adminDecisionResultSchema = z.object({
  status: applicationStatusSchema,
});

export const adminWhitelistPlayerSchema = z.object({
  accessId: z.string().uuid(),
  minecraftUsername: minecraftUsernameSchema,
  discordUsername: z.string(),
  discordDisplayName: z.string().nullable(),
  discordId: z.string(),
  discordAvatarUrl: z.string().url().nullable(),
  addedAt: z.string().datetime(),
});

export const adminWhitelistSchema = z.object({
  players: z.array(adminWhitelistPlayerSchema),
  count: z.number().int().nonnegative(),
});

export const adminWhitelistAddSchema = z
  .object({
    minecraftUsername: minecraftUsernameSchema,
    discordUsername: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => value !== "@"),
    discordId: z.string().regex(/^\d{17,20}$/),
  })
  .strict();

export const adminWhitelistRemoveSchema = z
  .object({ accessId: z.string().uuid() })
  .strict();

export const adminWhitelistMutationResultSchema = z.object({
  accessId: z.string().uuid(),
  status: accessStatusSchema,
  synchronization: z.literal("waiting"),
});

export type AdminApplicationFilter = z.infer<
  typeof adminApplicationFilterSchema
>;
export type AdminApplicationList = z.infer<typeof adminApplicationListSchema>;
export type AdminDecision = z.infer<typeof adminDecisionSchema>;
export type AdminWhitelist = z.infer<typeof adminWhitelistSchema>;
export type AdminWhitelistAdd = z.infer<typeof adminWhitelistAddSchema>;
export type AdminWhitelistRemove = z.infer<typeof adminWhitelistRemoveSchema>;
