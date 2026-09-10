import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export const randomToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string, secret: string) =>
  createHmac("sha256", secret).update(token).digest("hex");
export const equalSecret = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
