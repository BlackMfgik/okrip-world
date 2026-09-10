import { z } from "zod";
const secret = z.string().min(32);
const origin = z
  .string()
  .url()
  .refine(
    (v) => new URL(v).origin === v,
    "Use an origin without path or trailing slash",
  );
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    APP_BASE_URL: origin,
    WEB_ORIGIN: origin,
    SESSION_SECRET: secret,
    WEB_PROXY_SECRET: secret,
    DISCORD_CLIENT_ID: z.string().regex(/^\d+$/),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_REDIRECT_URI: z.string().url(),
    DISCORD_BOT_TOKEN: z.string().min(1),
    DISCORD_GUILD_ID: z.string().regex(/^\d+$/),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_WEBHOOK_SECRET: secret.regex(/^[A-Za-z0-9_-]+$/),
    TELEGRAM_ADMIN_CHAT_ID: z.string().regex(/^-?\d+$/),
    TELEGRAM_ADMIN_USER_IDS: z.string().regex(/^\d+(,\d+)*$/),
    MINECRAFT_SERVER_ID: z.string().min(1),
    MINECRAFT_SERVER_TOKEN: secret,
  })
  .superRefine((v, ctx) => {
    if (
      v.NODE_ENV === "production" &&
      [v.APP_BASE_URL, v.WEB_ORIGIN, v.DISCORD_REDIRECT_URI].some(
        (u) => !u.startsWith("https://"),
      )
    )
      ctx.addIssue({ code: "custom", message: "Production requires HTTPS" });
    if (v.APP_BASE_URL !== v.WEB_ORIGIN)
      ctx.addIssue({
        code: "custom",
        message:
          "MVP uses the web origin for browser callbacks and same-origin proxy",
      });
  });
export type Env = z.infer<typeof envSchema>;
