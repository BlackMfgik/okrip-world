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

function signed(
  body: unknown,
  key = privateKey,
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const raw = JSON.stringify(body);
  return {
    method: "POST" as const,
    url: "/v1/integrations/discord/interactions",
    headers: {
      "content-type": "application/json",
      "x-signature-timestamp": timestamp,
      "x-signature-ed25519": sign(
        null,
        Buffer.from(timestamp + raw),
        key,
      ).toString("hex"),
    },
    payload: raw,
  };
}

const click = (roles: string[], roleId = "20000000000000001") => ({
  type: 3,
  guild_id: "456",
  data: { custom_id: "role:" + roleId },
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

  // Валідний підпис зі старою міткою часу — повтор перехопленого запиту.
  const stale = String(Math.floor(Date.now() / 1000) - 301);
  expect(
    (await ctx.app.inject(signed({ type: 1 }, privateKey, stale))).statusCode,
  ).toBe(401);
});

it("refuses to grant a role that became privileged or disappeared, but still removes it", async () => {
  ctx = await setup({ DISCORD_PUBLIC_KEY: publicKeyHex });
  const stale = "⚠️ Ця кнопка більше не працює. Напиши адміністрації.";

  // «Модератор» має Administrator: стара кнопка не повинна його видати.
  const privileged = await ctx.app.inject(
    signed(click([], "20000000000000002")),
  );
  expect(privileged.json().data.content).toBe(stale);
  const missing = await ctx.app.inject(signed(click([], "29999999999999999")));
  expect(missing.json().data.content).toBe(stale);
  expect(ctx.discordBot.setMemberRole).not.toHaveBeenCalled();

  ctx.discordBot.guildRoles.mockResolvedValueOnce(null as never);
  const unavailable = await ctx.app.inject(signed(click([])));
  expect(unavailable.json().data.content).toContain("Не вдалося змінити роль");
  expect(ctx.discordBot.setMemberRole).not.toHaveBeenCalled();

  // Зняти небезпечну роль безпечно, тож це працює без перевірки.
  const callsBefore = ctx.discordBot.guildRoles.mock.calls.length;
  const removed = await ctx.app.inject(
    signed(click(["20000000000000002"], "20000000000000002")),
  );
  expect(removed.json().data.content).toContain("знято");
  expect(ctx.discordBot.setMemberRole).toHaveBeenLastCalledWith(
    "111",
    "20000000000000002",
    false,
  );
  expect(ctx.discordBot.guildRoles.mock.calls.length).toBe(callsBefore);
});

it("toggles the role on button click", async () => {
  ctx = await setup({ DISCORD_PUBLIC_KEY: publicKeyHex });
  const given = await ctx.app.inject(signed(click([])));
  expect(given.json()).toMatchObject({
    type: 4,
    data: {
      content:
        "✅ Ти отримав роль <@&20000000000000001>!\nЩоб зняти її, натисни кнопку ще раз.",
      flags: 64,
      allowed_mentions: { parse: [] },
    },
  });
  expect(ctx.discordBot.setMemberRole).toHaveBeenLastCalledWith(
    "111",
    "20000000000000001",
    true,
  );

  const removed = await ctx.app.inject(signed(click(["20000000000000001"])));
  expect(removed.json().data.content).toBe(
    "❌ Роль <@&20000000000000001> знято.\nЩоб повернути її, натисни кнопку ще раз.",
  );
  expect(ctx.discordBot.setMemberRole).toHaveBeenLastCalledWith(
    "111",
    "20000000000000001",
    false,
  );

  ctx.discordBot.setMemberRole.mockResolvedValueOnce(403);
  const denied = await ctx.app.inject(signed(click([])));
  expect(denied.json().data.content).toContain("Бот не може видати роль");
});

it("lets only the super admin post a role message, refusing privileged roles", async () => {
  ctx = await setup();
  const payload = {
    channelId: "10000000000000001",
    roleId: "20000000000000001",
    content: "Натисніть, щоб отримати роль гравця",
    buttonLabel: "Отримати роль",
    suppressEmbeds: true,
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
    username: "HeadModerator",
    global_name: null,
    avatar: null,
  });
  const headModerator = await login(ctx);
  const notSuperAdmin = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/discord/role-message",
    cookies: { okrip_session: headModerator.cookie },
    headers: browserHeaders,
    payload,
  });
  expect(notSuperAdmin.statusCode).toBe(403);

  ctx.discord.identity.mockResolvedValue({
    id: "554465791358140417",
    username: "SuperAdmin",
    global_name: null,
    avatar: null,
  });
  const admin = await login(ctx);
  const post = (body: {
    channelId: string;
    roleId: string;
    content: string;
    buttonLabel: string;
    suppressEmbeds?: boolean;
  }) =>
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
      flags: 4,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: "Отримати роль",
              custom_id: "role:20000000000000001",
            },
          ],
        },
      ],
    }),
  );

  const legacyPayload = {
    channelId: payload.channelId,
    roleId: payload.roleId,
    content: payload.content,
    buttonLabel: payload.buttonLabel,
  };
  expect((await post(legacyPayload)).statusCode).toBe(200);
  expect(ctx.discordBot.postMessage).toHaveBeenLastCalledWith(
    "10000000000000001",
    expect.not.objectContaining({ flags: expect.anything() }),
  );

  expect(
    (await post({ ...payload, roleId: "20000000000000002" })).statusCode,
  ).toBe(409);
  expect(
    (await post({ ...payload, roleId: "29999999999999999" })).statusCode,
  ).toBe(404);
  expect(ctx.discordBot.postMessage).toHaveBeenCalledTimes(2);

  const withoutLabel = await post({ ...payload, buttonLabel: "  " });
  expect(withoutLabel.statusCode, withoutLabel.body).toBe(200);
  expect(ctx.discordBot.postMessage).toHaveBeenLastCalledWith(
    "10000000000000001",
    expect.objectContaining({
      components: [
        {
          type: 1,
          components: [expect.objectContaining({ label: "Отримати роль" })],
        },
      ],
    }),
  );

  const plain = await post({ ...payload, roleId: "", buttonLabel: "" });
  expect(plain.statusCode, plain.body).toBe(200);
  expect(plain.json()).toEqual({
    messageId: "30000000000000001",
    channelId: "10000000000000001",
  });
  expect(ctx.discordBot.postMessage).toHaveBeenLastCalledWith(
    "10000000000000001",
    expect.not.objectContaining({ components: expect.anything() }),
  );

  expect((await post({ ...payload, roleId: "" })).statusCode).toBe(400);
  expect(ctx.discordBot.postMessage).toHaveBeenCalledTimes(4);
});

it("lists postable channels and assignable roles to the super admin and the owner only", async () => {
  ctx = await setup();
  const get = (cookie: string) =>
    ctx.app.inject({
      method: "GET",
      url: "/v1/admin/discord/options",
      cookies: { okrip_session: cookie },
    });

  const player = await login(ctx);
  expect((await get(player.cookie)).statusCode).toBe(403);
  expect(ctx.discordBot.guildChannels).not.toHaveBeenCalled();

  ctx.discord.identity.mockResolvedValue({
    id: "554465791358140417",
    username: "SuperAdmin",
    global_name: null,
    avatar: null,
  });
  const admin = await login(ctx);
  const options = await get(admin.cookie);
  expect(options.statusCode, options.body).toBe(200);
  expect(options.json()).toEqual({
    channels: [
      { id: "10000000000000004", name: "новини", category: null },
      { id: "10000000000000002", name: "загальний", category: "Чат" },
      { id: "10000000000000001", name: "правила", category: "Інфо" },
    ],
    // Без @everyone, адмінської, службової та вищої за бота ролей.
    roles: [{ id: "20000000000000001", name: "Гравець" }],
  });

  ctx.discordBot.botRoleIds.mockResolvedValueOnce(null);
  expect((await get(admin.cookie)).statusCode).toBe(503);

  // Власник має доступ до розділу Discord, але не стає суперадміном.
  ctx.discord.identity.mockResolvedValue({
    id: "302714744626741248",
    username: "Owner",
    global_name: null,
    avatar: null,
  });
  const owner = await login(ctx);
  expect(
    (
      await ctx.app.inject({
        url: "/v1/me",
        cookies: { okrip_session: owner.cookie },
      })
    ).json().user,
  ).toMatchObject({ isSuperAdmin: false, canManageDiscord: true });
  expect((await get(owner.cookie)).statusCode).toBe(200);
  const posted = await ctx.app.inject({
    method: "POST",
    url: "/v1/admin/discord/role-message",
    cookies: { okrip_session: owner.cookie },
    headers: browserHeaders,
    payload: { channelId: "10000000000000001", content: "Привіт" },
  });
  expect(posted.statusCode, posted.body).toBe(200);
});
