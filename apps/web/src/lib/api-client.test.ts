import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { apiRequest } from "./api-client";

const schema = z.object({ ok: z.boolean() });

afterEach(() => {
  vi.unstubAllGlobals();
});

test("replaces the browser network error with a clear message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  await expect(apiRequest("/me", schema)).rejects.toThrow(
    "Немає зв'язку із сервером. Перевірте інтернет і спробуйте ще раз.",
  );
});

test("reports a timeout separately from a lost connection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")),
  );
  await expect(apiRequest("/me", schema)).rejects.toThrow(
    "Сервер не відповідає. Спробуйте ще раз за кілька хвилин.",
  );
});

test("reports a connection lost while reading the response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new TypeError("network error")),
    }),
  );
  await expect(apiRequest("/me", schema)).rejects.toThrow(
    "Немає зв'язку із сервером. Перевірте інтернет і спробуйте ще раз.",
  );
});

test("keeps the message returned by the API", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "Недостатньо прав." }, { status: 403 }),
      ),
  );
  await expect(apiRequest("/me", schema)).rejects.toThrow("Недостатньо прав.");
});
