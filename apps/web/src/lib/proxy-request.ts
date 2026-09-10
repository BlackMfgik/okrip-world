import { createHmac } from "node:crypto";
import { isIP } from "node:net";
export function proxyHeaders(request: Request, secret: string) {
  const headers = new Headers();
  for (const name of ["cookie", "origin", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Railway's edge overwrites X-Real-IP. Only enable this trust boundary on Railway.
  const candidate = process.env.RAILWAY_ENVIRONMENT_ID
    ? request.headers.get("x-real-ip")
    : "127.0.0.1";
  const ip = candidate && isIP(candidate) ? candidate : "127.0.0.1",
    stamp = String(Date.now());
  headers.set("x-okrip-client-ip", ip);
  headers.set("x-okrip-proxy-time", stamp);
  headers.set(
    "x-okrip-proxy-signature",
    createHmac("sha256", secret)
      .update(ip + ":" + stamp)
      .digest("hex"),
  );
  return headers;
}
export async function boundedBody(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        throw new RangeError("Body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
