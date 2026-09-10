import { expect, it } from "vitest";
import { setup, login, env } from "./helpers.js";
import { users, commands, applications } from "../src/db/schema.js";
import { applicationService } from "../src/modules/applications/application.service.js";
import { moderationService } from "../src/modules/moderation/moderation.service.js";
it("serializes competing submissions and competing moderation decisions", async () => {
  const ctx = await setup();
  try {
    await login(ctx);
    const user = (await ctx.db.select().from(users))[0]!;
    const service = applicationService(ctx.db, ctx.discord);
    const submissions = await Promise.allSettled([
      service.submit(user, { minecraftUsername: "Player_One" }),
      service.submit(user, { minecraftUsername: "Player_One" }),
    ]);
    expect(submissions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const app = (await ctx.db.select().from(applications))[0]!;
    const moderation = moderationService(ctx.db, env);
    const decisions = await Promise.all([
      moderation.decide(app.publicId, "approve", "77", "-100"),
      moderation.decide(app.publicId, "approve", "77", "-100"),
    ]);
    expect(decisions).toEqual(["approved", "approved"]);
    expect(await ctx.db.select().from(commands)).toHaveLength(1);
  } finally {
    await ctx.close();
  }
});

it("a failed player command does not block another player", async () => {
  const ctx = await setup();
  try {
    await login(ctx);
    const first = (await ctx.db.select().from(users))[0]!;
    const second = (
      await ctx.db
        .insert(users)
        .values({ discordId: "222", discordUsername: "Second" })
        .returning()
    )[0]!;
    const applicationsService = applicationService(ctx.db, ctx.discord),
      moderation = moderationService(ctx.db, env);
    for (const [user, name] of [
      [first, "Player_One"],
      [second, "Player_Two"],
    ] as const) {
      const app = await applicationsService.submit(user, {
        minecraftUsername: name,
      });
      await moderation.decide(
        app.application!.publicId,
        "approve",
        "77",
        "-100",
      );
    }
    const { minecraftService } =
      await import("../src/modules/minecraft/minecraft-command.service.js");
    const service = minecraftService(ctx.db, env.MINECRAFT_SERVER_ID);
    const command = (await service.lease()).commands[0]!;
    await service.acknowledge(
      command.id,
      command.leaseToken,
      "execution_failed",
    );
    expect((await service.lease()).commands[0]!.payload.username).toBe(
      "Player_Two",
    );
  } finally {
    await ctx.close();
  }
});
