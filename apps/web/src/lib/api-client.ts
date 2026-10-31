import type { z } from "zod";

// Браузер кидає технічний текст («Failed to fetch»), який не можна показувати людині.
function connectionError(error: unknown) {
  return new Error(
    error instanceof DOMException && error.name === "TimeoutError"
      ? "Сервер не відповідає. Спробуйте ще раз за кілька хвилин."
      : "Немає зв'язку із сервером. Перевірте інтернет і спробуйте ще раз.",
  );
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  }).catch((error: unknown) => {
    throw connectionError(error);
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.message === "string"
        ? error.message
        : "Не вдалося виконати запит. Спробуйте ще раз.",
    );
  }
  const data: unknown = await response.json().catch((error: unknown) => {
    throw connectionError(error);
  });
  return schema.parse(data);
}
