import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminPanel } from "./AdminPanel";

const permissions = vi.hoisted(() => ({ isAdmin: true }));
vi.mock("@/features/auth/hooks/useCurrentSession", () => ({
  useCurrentSession: () => ({
    isPending: false,
    data: {
      user: {
        username: "Moderator",
        displayName: "Moderator",
        isAdmin: permissions.isAdmin,
        canManageAdmins: false,
        isSuperAdmin: false,
      },
    },
  }),
}));

const application = {
  publicId: "abcdefghijklmnop",
  number: 1,
  discordUsername: "player",
  discordAccountCreatedAt: "2016-04-30T11:18:25.796Z",
  discordGuildJoinedAt: "2026-09-01T10:20:30.000Z",
  discordDisplayName: null,
  discordAvatarUrl: null,
  minecraftUsername: "Player_One",
  applicationBlocked: false,
  applicationBlockedUntil: null,
  status: "pending",
  rejectionReason: null,
  reviewerName: null,
  createdAt: "2026-10-06T09:00:00.000Z",
  reviewedAt: null,
};
const counts = {
  all: 1,
  pending: 1,
  approved: 0,
  rejected: 0,
  cancelled: 0,
  blocked: 0,
};
const request = vi.fn(
  async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = String(input);
    if (path.includes("/applications?"))
      return Response.json({ applications: [application], counts });
    if (path.endsWith("/applications/decision"))
      return Response.json({ status: "approved" });
    if (path.endsWith("/applications/block"))
      return Response.json({
        publicId: application.publicId,
        applicationBlocked: true,
        applicationBlockedUntil: null,
      });
    if (path.endsWith("/whitelist"))
      return Response.json({ players: [], count: 0 });
    throw new Error("Unexpected request: " + path + " " + options?.method);
  },
);
let client: QueryClient;

beforeEach(() => {
  permissions.isAdmin = true;
  request.mockClear();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", request);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

function openPanel() {
  render(
    <QueryClientProvider client={client}>
      <AdminPanel />
    </QueryClientProvider>,
  );
}

test("shows Discord account creation and server join dates in Kyiv time", async () => {
  openPanel();
  const creation = (
    await screen.findByText("Акаунт Discord створено")
  ).parentElement!.querySelector("time")!;
  const join = screen
    .getByText("Приєднався до Discord-сервера")
    .parentElement!.querySelector("time")!;
  expect(creation.getAttribute("datetime")).toBe(
    application.discordAccountCreatedAt,
  );
  expect(creation.textContent).toContain("14:18");
  expect(join.getAttribute("datetime")).toBe(application.discordGuildJoinedAt);
  expect(join.textContent).toContain("13:20");
});

test("shows unknown dates for an older API response without inventing timestamps", async () => {
  request.mockImplementationOnce(async () =>
    Response.json({
      applications: [
        {
          ...application,
          discordAccountCreatedAt: undefined,
          discordGuildJoinedAt: undefined,
        },
      ],
      counts,
    }),
  );
  openPanel();
  expect(await screen.findAllByText("Немає даних")).toHaveLength(2);
});

test("does not fetch administrative data for a player", () => {
  permissions.isAdmin = false;
  openPanel();
  expect(screen.getByText("Сторінка недоступна")).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});

test("requires confirmation before approving and refreshes the whitelist", async () => {
  client.setQueryData(["admin", "whitelist"], { players: [], count: 0 });
  openPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Схвалити" }));
  expect(
    request.mock.calls.some(([url]) => String(url).endsWith("/decision")),
  ).toBe(false);
  const dialog = screen.getByRole("dialog", {
    name: "Схвалити заявку Player_One?",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Схвалити" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/v1/admin/applications/decision",
      expect.objectContaining({
        body: JSON.stringify({
          publicId: application.publicId,
          action: "approve",
        }),
      }),
    ),
  );
  await waitFor(() =>
    expect(client.getQueryState(["admin", "whitelist"])?.isInvalidated).toBe(
      true,
    ),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("submits the rejection reason from the extracted application card", async () => {
  openPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Відхилити" }));
  fireEvent.change(screen.getByLabelText("Причина відмови"), {
    target: { value: "Потрібне уточнення" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Відхилити" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/v1/admin/applications/decision",
      expect.objectContaining({
        body: JSON.stringify({
          publicId: application.publicId,
          action: "reject",
          rejectionReason: "Потрібне уточнення",
        }),
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByLabelText("Причина відмови")).toBeNull(),
  );
});

test("preserves the selected filter across sections and pauses inactive queries", async () => {
  openPanel();
  await screen.findByRole("heading", { name: "Player_One" });
  fireEvent.click(screen.getByRole("button", { name: /Схвалені/ }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/v1/admin/applications?status=approved",
      expect.anything(),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Вайтліст" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/v1/admin/whitelist",
      expect.anything(),
    ),
  );
  const before = request.mock.calls.filter(([url]) =>
    String(url).includes("/applications?"),
  ).length;
  await client.invalidateQueries({ queryKey: ["admin", "applications"] });
  expect(
    request.mock.calls.filter(([url]) => String(url).includes("/applications?"))
      .length,
  ).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Заявки" }));
  expect(screen.getByRole("button", { name: /Схвалені/ }).className).toBe(
    "is-active",
  );
  await waitFor(() =>
    expect(
      request.mock.calls.filter(([url]) =>
        String(url).includes("status=approved"),
      ).length,
    ).toBe(2),
  );
});
