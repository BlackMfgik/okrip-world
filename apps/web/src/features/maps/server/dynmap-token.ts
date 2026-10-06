import { createHmac, timingSafeEqual } from "node:crypto";

// Мапа, закрита для гравців, віддається через проксі лише з токеном у шляху:
// /dynmap/<токен>/index.html. Документ Dynmap працює в sandbox з opaque origin і
// не шле cookies, тож сесію адміна перевіряє сторінка мапи, а проксі — лише підпис.

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function sign(expires: string, secret: string) {
  return createHmac("sha256", secret)
    .update("dynmap:" + expires)
    .digest("base64url");
}

/** Токен доступу до закритої мапи або null, якщо WEB_PROXY_SECRET не налаштовано. */
export function createDynmapToken() {
  const secret = process.env.WEB_PROXY_SECRET;
  if (!secret) return null;
  const expires = String(Date.now() + TOKEN_TTL_MS);
  return expires + "." + sign(expires, secret);
}

export function verifyDynmapToken(token: string) {
  const secret = process.env.WEB_PROXY_SECRET;
  const [expires, signature, ...rest] = token.split(".");
  if (!secret || !expires || !signature || rest.length) return false;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires, secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
