import { once } from "node:events";
import { afterEach, beforeEach, expect, it } from "vitest";
import { setup, login, browserHeaders, serverHeaders } from "./helpers.js";

let ctx: Awaited<ReturnType<typeof setup>>;

async function nextMessage(socket: Awaited<ReturnType<typeof ctx.app.injectWS>>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      once(socket, "message"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 2_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

beforeEach(async () => {
  ctx = await setup();
});

afterEach(async () => ctx.close());

it("rejects a watcher without Minecraft server credentials", async () => {
  await ctx.app.ready();
  await expect(
    ctx.app.injectWS("/v1/minecraft/commands/watch"),
  ).rejects.toThrow("Unexpected server response: 401");
});

it("signals the plugin on connect and after a whitelist command commits", async () => {
  await ctx.app.ready();
  const socket = await ctx.app.injectWS("/v1/minecraft/commands/watch", {
    headers: serverHeaders,
  });

  const [initial] = await nextMessage(socket, "initial signal");
  expect(initial.toString()).toBe('{"type":"commands_available"}');

  const { cookie } = await login(ctx);
  const submitted = await ctx.app.inject({
    method: "POST",
    url: "/v1/applications",
    cookies: { okrip_session: cookie },
    headers: browserHeaders,
    payload: { minecraftUsername: "Player_One" },
  });
  const signal = nextMessage(socket, "approval signal");
  await ctx.app.inject({
    method: "POST",
    url: "/v1/integrations/telegram/webhook",
    headers: { "x-telegram-bot-api-secret-token": "t".repeat(32) },
    payload: {
      update_id: 1,
      callback_query: {
        id: "callback",
        from: { id: 77 },
        data: "approve:" + submitted.json().application.publicId,
        message: { message_id: 123, chat: { id: -100 } },
      },
    },
  });

  const [message] = await signal;
  expect(message.toString()).toBe('{"type":"commands_available"}');
  socket.close();
});
