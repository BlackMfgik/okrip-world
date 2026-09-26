import type { CurrentApplication } from "@okrip/contracts";

/**
 * Після відкликання доступу гравець може подати нову заявку. Поки остання заявка —
 * та, що колись дала доступ (approved), показуємо «Доступ відкликано»; щойно подано
 * нову, стан визначає вже вона, а не старий revoked.
 */
export function effectiveAccess(data: CurrentApplication | undefined) {
  if (
    data?.access === "revoked" &&
    data.application &&
    data.application.status !== "approved"
  )
    return null;
  return data?.access ?? null;
}
