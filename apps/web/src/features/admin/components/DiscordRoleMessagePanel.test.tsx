import { expect, it } from "vitest";
import { parseMessageLink } from "./DiscordRoleMessagePanel";

it("reads channel and message IDs from a Discord message link", () => {
  expect(
    parseMessageLink(
      " https://discord.com/channels/456789012345678901/10000000000000001/30000000000000001 ",
    ),
  ).toEqual({
    channelId: "10000000000000001",
    messageId: "30000000000000001",
  });
  expect(
    parseMessageLink(
      "https://ptb.discord.com/channels/456789012345678901/10000000000000001/30000000000000001/",
    ),
  ).toEqual({
    channelId: "10000000000000001",
    messageId: "30000000000000001",
  });
  expect(
    parseMessageLink(
      "https://discord.com/channels/456789012345678901/10000000000000001",
    ),
  ).toBeNull();
  expect(parseMessageLink("30000000000000001")).toBeNull();
});
