import { AppError } from "./errors.js";
export async function externalRequest(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
      throw new AppError(
        503,
        "provider_unavailable",
        "Зовнішній сервіс тимчасово недоступний.",
      );
    }
    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < retries
    ) {
      await response.body?.cancel();
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    return response;
  }
}
