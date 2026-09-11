import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setup, login, env, browserHeaders } from "./helpers.js";
import { users, sessions } from "../src/db/schema.js";
let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => ctx.close());
describe("OAuth and sessions", () => {
  it("consumes browser-bound state once and stores only a hashed session", async () => {
    const { callback, cookie, state, browser } = await login(ctx);
    expect(callback.statusCode).toBe(302);
    expect((await ctx.db.select().from(sessions))[0]!.tokenHash).not.toBe(
      cookie,
    );
    expect(
      callback.cookies.find((c) => c.name === "okrip_session")!.httpOnly,
    ).toBe(true);
    const replay = await ctx.app.inject({
      url: "/v1/auth/discord/callback?code=valid&state=" + state,
      cookies: { okrip_oauth: browser },
    });
    expect(replay.headers.location).toContain("error=login_failed");
    expect(ctx.discord.identity).toHaveBeenCalledTimes(1);
    expect(ctx.discord.membership).not.toHaveBeenCalled();
    expect(
      (
        await ctx.app.inject({
          url: "/v1/me",
          cookies: { okrip_session: cookie },
        })
      ).json().user.username,
    ).toBe("DiscordName");
  });
  it("keeps stable Discord ID after rename and rejects a different browser", async () => {
    await login(ctx);
    ctx.discord.identity.mockResolvedValue({
      id: "111",
      username: "Renamed",
      global_name: null,
      avatar: null,
    });
    await login(ctx);
    expect(await ctx.db.select().from(users)).toHaveLength(1);
    const start = await ctx.app.inject({ url: "/v1/auth/discord/start" });
    const state = new URL(start.headers.location!).searchParams.get("state");
    const response = await ctx.app.inject({
      url: "/v1/auth/discord/callback?code=x&state=" + state,
      cookies: { okrip_oauth: "wrong" },
    });
    expect(response.headers.location).toContain("error=login_failed");
  });
  it("blocks cross-origin mutation and revokes logout", async () => {
    const { cookie } = await login(ctx);
    const cookies = { okrip_session: cookie };
    expect(
      (
        await ctx.app.inject({
          method: "POST",
          url: "/v1/auth/logout",
          cookies,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await ctx.app.inject({
          method: "POST",
          url: "/v1/auth/logout",
          cookies,
          headers: browserHeaders,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await ctx.app.inject({ url: "/v1/me", cookies })).json().user,
    ).toBeNull();
    expect(env.SESSION_SECRET).toHaveLength(32);
  });
});
