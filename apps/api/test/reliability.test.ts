import { beforeEach, afterEach, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { setup, login, env, serverHeaders, browserHeaders } from "./helpers.js";
import {
  applications,
  commands,
  playerAccess,
  users,
  telegramJobs,
  identities,
} from "../src/db/schema.js";
import {
  APPLICATION_SUBMISSION_COOLDOWN_MS,
  applicationService,
} from "../src/modules/applications/application.service.js";
import { moderationService } from "../src/modules/moderation/moderation.service.js";
import { minecraftService } from "../src/modules/minecraft/minecraft-command.service.js";
let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});
afterEach(async () => ctx.close());
async function pending() {
  await login(ctx);
  const user = (await ctx.db.select().from(users))[0]!;
  const service = applicationService(ctx.db, ctx.discord);
  const submitted = await service.submit(user, {
    minecraftUsername: "Player_One",
  });
  return { user, service, publicId: submitted.application!.publicId };
}
async function approved() {
  const data = await pending();
  await moderationService(ctx.db, env).decide(
    data.publicId,
    "approve",
    "77",
    "-100",
  );
  return data;
}
it("expires leases, fences stale acknowledgement, retries failures, and serializes delivery", async () => {
  await approved();
  const service = minecraftService(ctx.db, env.MINECRAFT_SERVER_ID);
  const first = (await service.lease()).commands[0]!;
  expect((await service.lease()).commands).toHaveLength(0);
  await ctx.db
    .update(commands)
    .set({ leaseUntil: new Date(Date.now() - 1000) })
    .where(eq(commands.id, first.id));
  const second = (await service.lease()).commands[0]!;
  expect(second.id).toBe(first.id);
  expect(second.leaseToken).not.toBe(first.leaseToken);
  await expect(
    service.acknowledge(first.id, first.leaseToken),
  ).rejects.toMatchObject({ code: "stale_lease" });
  await service.acknowledge(second.id, second.leaseToken, "execution_failed");
  expect((await service.lease()).commands).toHaveLength(0);
  await ctx.db
    .update(commands)
    .set({ availableAt: new Date(Date.now() - 1000) });
  const third = (await service.lease()).commands[0]!;
  await service.acknowledge(third.id, third.leaseToken);
  expect((await ctx.db.select().from(commands))[0]!.attempts).toBe(3);
});
it("ban cannot be bypassed by OAuth, resubmission, a stale approval or direct DB writes", async () => {
  const { user, service, publicId } = await approved();
  const minecraft = minecraftService(ctx.db, env.MINECRAFT_SERVER_ID);
  const event = {
    eventId: randomUUID(),
    username: "player_one",
    reason: "Moderation",
  };
  await minecraft.ban(event);
  await minecraft.ban(event);
  await login(ctx);
  await expect(
    service.submit(user, { minecraftUsername: "Player_One" }),
  ).rejects.toMatchObject({ code: "access_exists" });
  expect(
    await moderationService(ctx.db, env).decide(
      publicId,
      "approve",
      "77",
      "-100",
    ),
  ).toBe("approved");
  expect((await ctx.db.select().from(playerAccess))[0]!.status).toBe("banned");
  expect(await ctx.db.select().from(commands)).toHaveLength(3);
  expect((await minecraft.lease()).commands).toHaveLength(0); // Superseded add is discarded.
  expect((await minecraft.lease()).commands[0]!.type).toBe("whitelist_remove");
  const identity = (await ctx.db.select().from(identities))[0]!;
  await expect(
    ctx.db.insert(applications).values({
      publicId: "new",
      userId: user.id,
      minecraftIdentityId: identity.id,
    }),
  ).rejects.toThrow();
  await expect(
    ctx.db.update(playerAccess).set({ status: "active" }),
  ).rejects.toThrow();
  expect((await service.current(user.id)).access).toBe("banned");
});
it("rejection is final, delays same-name resubmission, and never creates a command", async () => {
  const { user, service, publicId } = await pending();
  const moderation = moderationService(ctx.db, env);
  expect(
    await moderation.decide(
      publicId,
      "reject",
      "77",
      "-100",
      "Невідповідна заявка",
    ),
  ).toBe("rejected");
  expect(await moderation.decide(publicId, "approve", "77", "-100")).toBe(
    "rejected",
  );
  expect(await ctx.db.select().from(commands)).toHaveLength(0);
  await expect(
    service.submit(user, { minecraftUsername: "Player_One" }),
  ).rejects.toMatchObject({ code: "application_cooldown" });
  await ctx.db
    .update(applications)
    .set({
      createdAt: new Date(
        Date.now() - APPLICATION_SUBMISSION_COOLDOWN_MS - 1_000,
      ),
    })
    .where(eq(applications.publicId, publicId));
  expect(
    (await service.submit(user, { minecraftUsername: "Player_One" }))
      .application!.status,
  ).toBe("pending");
});
it("rolls back approval if outbox insert fails", async () => {
  const { publicId } = await pending();
  await ctx.db.execute(
    sql`CREATE FUNCTION fail_command_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END $$`,
  );
  await ctx.db.execute(
    sql`CREATE TRIGGER fail_command_test BEFORE INSERT ON minecraft_commands FOR EACH ROW EXECUTE FUNCTION fail_command_test()`,
  );
  await expect(
    moderationService(ctx.db, env).decide(publicId, "approve", "77", "-100"),
  ).rejects.toThrow();
  expect((await ctx.db.select().from(applications))[0]!.status).toBe("pending");
  expect(await ctx.db.select().from(playerAccess)).toHaveLength(0);
});
it("keeps the Telegram notification after delivery failure", async () => {
  await pending();
  ctx.telegram.call.mockRejectedValueOnce(new Error("Network failure"));
  await expect(ctx.worker.tick()).rejects.toThrow();
  expect((await ctx.db.select().from(telegramJobs))[0]!.completedAt).toBeNull();
  await ctx.db
    .update(telegramJobs)
    .set({ availableAt: new Date(Date.now() - 1000) });
  await ctx.worker.tick();
  expect(
    (await ctx.db.select().from(telegramJobs))[0]!.completedAt,
  ).not.toBeNull();
});
it("rejects missing integration secrets, foreign server tokens and CSRF query bypass", async () => {
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/minecraft/commands/lease",
        payload: { limit: 1 },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/minecraft/commands/lease",
        headers: { ...serverHeaders, "x-server-id": "foreign" },
        payload: { limit: 1 },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/integrations/telegram/webhook",
        payload: { update_id: 1 },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/applications?bypass=true",
        payload: { minecraftUsername: "Player_One" },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await ctx.app.inject({
        method: "POST",
        url: "/v1/applications",
        headers: browserHeaders,
        payload: { minecraftUsername: "Player_One" },
      })
    ).statusCode,
  ).toBe(401);
});
