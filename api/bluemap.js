export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/bluemap/, "") || "/";
  const target = `http://ip199-83-103-227.joinserver.xyz:25718${path}`;

  try {
    const response = await fetch(target);
    const contentType = response.headers.get("content-type") || "";
    res.setHeader("Content-Type", contentType);
    const buffer = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(buffer));
  } catch (e) {
    res.status(502).send("Proxy error");
  }
}
