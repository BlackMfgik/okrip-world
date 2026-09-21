import { z } from "zod";
import { applicationStatusSchema } from "./applications.js";

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

export type AdminApplicationFilter = z.infer<
  typeof adminApplicationFilterSchema
>;
export type AdminApplicationList = z.infer<
  typeof adminApplicationListSchema
>;
export type AdminDecision = z.infer<typeof adminDecisionSchema>;
