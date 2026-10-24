import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CurrentApplication } from "@okrip/contracts";
import { ApplicationPanel } from "./ApplicationPanel";
const state = vi.hoisted(() => ({
  data: null as null | Partial<CurrentApplication>,
}));
vi.stubGlobal("React", React);
vi.mock("@/features/auth/hooks/useCurrentSession", () => ({
  useCurrentSession: () => ({ data: { user: { username: "Player" } } }),
}));
vi.mock("../hooks/useCurrentApplication", () => ({
  useCurrentApplication: () => ({ data: state.data, refetch: vi.fn() }),
}));
vi.mock("./ApplicationForm", () => ({
  ApplicationForm: () => <p>Форма заявки</p>,
}));
vi.mock("./ReapplyButton", () => ({
  ReapplyButton: () => <p>Кнопка повторної заявки</p>,
}));
afterEach(() => {
  cleanup();
  state.data = null;
});

test("revoked access without an application (added from the admin panel) shows the form", () => {
  state.data = {
    application: null,
    access: "revoked",
    synchronization: null,
    nextSubmissionAt: null,
  };
  render(<ApplicationPanel />);
  expect(screen.getByText("Доступ відкликано")).toBeTruthy();
  expect(screen.getByText("Форма заявки")).toBeTruthy();
});

test("revoked access after an approved application keeps the reapply button", () => {
  state.data = {
    application: {
      publicId: "pub",
      minecraftUsername: "Player_One",
      status: "approved",
      rejectionReason: null,
    },
    access: "revoked",
    synchronization: null,
    nextSubmissionAt: null,
  };
  render(<ApplicationPanel />);
  expect(screen.getByText("Кнопка повторної заявки")).toBeTruthy();
  expect(screen.queryByText("Форма заявки")).toBeNull();
});
