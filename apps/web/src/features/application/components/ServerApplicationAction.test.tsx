import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ServerApplicationAction } from "./ServerApplicationAction";
const state = vi.hoisted(() => ({
  loggedIn: false,
  status: null as null | "pending" | "approved" | "rejected",
}));
vi.stubGlobal("React", React);
vi.mock("@/features/auth/hooks/useCurrentSession", () => ({ useCurrentSession: () => ({ data: { user: state.loggedIn ? { username: "Player" } : null } }) }));
vi.mock("../hooks/useCurrentApplication", () => ({ useCurrentApplication: () => ({ data: { application: state.status ? { status: state.status } : null, access: state.status === "approved" ? "active" : null }, refetch: vi.fn() }) }));
vi.mock("./ApplicationPanel", () => ({ ApplicationPanel: () => <p>Заявку передано адміністрації</p> }));
HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
afterEach(() => { cleanup(); state.loggedIn = false; state.status = null; });
test("guest gets Discord login on the server card", () => {
  render(<ServerApplicationAction />);
  const button = screen.getByRole("button", { name: "Авторизуватись через Discord" });
  expect(button.closest("form")?.getAttribute("action")).toBe("/v1/auth/discord/start");
});
test("submitted application changes the action and opens a dismissible status dialog", () => {
  state.loggedIn = true;
  const view = render(<ServerApplicationAction />);
  expect(screen.getByRole("button", { name: "Подати заявку" })).toBeTruthy();
  expect(
    screen.getByText("Вхід на сервер — після схвалення заявки."),
  ).toBeTruthy();
  state.status = "pending";
  view.rerender(<ServerApplicationAction />);
  expect(
    screen.queryByText("Вхід на сервер — після схвалення заявки."),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "⏳ Заявка на розгляді" }));
  expect(screen.getByRole("dialog", { name: "Моя заявка" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Закрити вікно" }),
  ).toBeNull();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent(screen.getByRole("dialog"), new Event("cancel"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
});
test("application action reflects approved and rejected statuses", () => {
  state.loggedIn = true;
  state.status = "approved";
  const view = render(<ServerApplicationAction />);
  expect(screen.getByRole("button", { name: "✅ Заявку схвалено" })).toBeTruthy();

  state.status = "rejected";
  view.rerender(<ServerApplicationAction />);
  expect(screen.getByRole("button", { name: "❌ Заявку відхилено" })).toBeTruthy();
});
