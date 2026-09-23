import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

vi.stubGlobal("React", React);

afterEach(cleanup);

test("uses a styled in-page confirmation instead of a browser prompt", () => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <AdminConfirmDialog
      confirmLabel="Нєт іді нахуй"
      description="Гравець отримає таймаут."
      onCancel={onCancel}
      onConfirm={onConfirm}
      pending={false}
      title="Таймаут на одну годину"
      tone="hour"
    />,
  );

  expect(
    screen.getByRole("dialog", { name: "Таймаут на одну годину" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Нєт іді нахуй" }));
  expect(onConfirm).toHaveBeenCalledOnce();

  fireEvent.keyDown(window, { key: "Escape" });
  expect(onCancel).toHaveBeenCalledOnce();
});
