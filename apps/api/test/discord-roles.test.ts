import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { browserHeaders, login, setup } from "./helpers.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
// Сирий 32-байтний ключ — те, що Discord показує як Public Key застосунку.
const publicKeyHex = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(12)
  .toString("hex");

let ctx: Awaited<ReturnType<typeof setup>>;
afterEach(async () => ctx.close());

function signed(body: unknown, key = privateKey) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    method: "POST" as const,
    url: "/v1/integrations/discord/interactions",
    headers: {
      "content-type": "application/json",
      "x-signature-timestamp": timestamp,
      "x-signature-ed25519": sign(null, Buffer.from(timestamp + raw), key).toString("hex"),
    },
    payload: raw,
  };
}

const click = (roles: string[]) => ({
  type: 3,
  guild_id: "456",
  data: { custom_id: "role:20000000000000001" },
  member: { user: { id: "111" }, roles },
});

it("answers Discord PING and rejects unsigned or forged interactions", async () => {
  ctx = await setup({ DISCORD_PUBLIC_KEY: publicKeyHex });
  const ping = await ctx.app.inject(signed({ type: 1 }));
  expect(ping.statusCode, ping.body).toBe(200);
  expect(ping.json()).toEqual({ type: 1 });

  const forged = signed({ type: 1 }, generateKeyPairSync("ed25519").privateKey);
  expect((await ctx.app.inject(forged)).statusCode).toBe(401);
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/integrations/discord/interactions",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ type: 1 }),
      })
    ).statusCode,
  ).toBe(401);
});

it("toggles the role on button click", async () => {
  ctx = await setup({ DISCORD_PUBLIC_KEY: publicKeyHex });
  const given = await ctx.app.inject(signed(click([])));
  expect(given.json()).toMatchObject({ type: 4, data: { content: "Роль видано! ✅", flags: 64 } });
  expect(ctx.discordBot.setMemberRole).toHaveBeenLastCalledWith("111", "20000000000000001", true);

  const removed = await ctx.app.inject(signed(click(["20000000000000001"])));
  expect(removed.json().data.content).toBe("Роль знято.");
  expect(ctx.discordBot.setMemberRole).toHaveBeenLastCalledWith("111", "20000000000000001", false);

  ctx.discordBot.setMemberRole.mockResolvedValueOnce(403);
  const denied = await ctx.app.inject(signed(click([])));
  expect(denied.json().data.content).toContain("Бот не може змінити цю роль");
});

it("lets only admin managers post a role message, refusing privileged roles", async () => {
  ctx = await setup();
  const payload = {
    channelId: "10000000000000001",
    roleId: "20000000000000001",
    content: "Натисніть, щоб отримати роль гравця",
    buttonLabel: "Отримати роль",
  };
  const player = await login(ctx);
  const forbidden = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/discord/role-message",
    cookies: { okrip_session: player.cookie },
    headers: browserHeaders,
    payload,
  });
  expect(forbidden.statusCode).toBe(403);

  ctx.discord.identity.mockResolvedValue({
    id: "876509255308541977",
    username: "WebAdmin",
    global_name: null,
    avatar: null,
  });
  const admin = await login(ctx);
  const post = (body: typeof payload) =>
    ctx.app.inject({
      method: "POST",
      url: "/v1/admin/discord/role-message",
      cookies: { okrip_session: admin.cookie },
      headers: browserHeaders,
      payload: body,
    });

  const posted = await post(payload);
  expect(posted.statusCode, posted.body).toBe(200);
  expect(posted.json()).toEqual({
    messageId: "30000000000000001",
    channelId: "10000000000000001",
    roleName: "Гравець",
  });
  expect(ctx.discordBot.postMessage).toHaveBeenCalledWith(
    "10000000000000001",
    expect.objectContaining({
      content: payload.content,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: "Отримати роль", custom_id: "role:20000000000000001" },
          ],
        },
      ],
    }),
  );

  expect((await post({ ...payload, roleId: "20000000000000002" })).statusCode).toBe(409);
  expect((await post({ ...payload, roleId: "29999999999999999" })).statusCode).toBe(404);
  expect(ctx.discordBot.postMessage).toHaveBeenCalledTimes(1);
});
