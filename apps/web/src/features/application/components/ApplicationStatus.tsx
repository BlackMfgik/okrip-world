import type { CurrentApplication } from "@okrip/contracts";
import { effectiveAccess } from "../effective-access";
export function ApplicationStatus({ data }: { data: CurrentApplication }) {
  const access = effectiveAccess(data);
  let title = "Заявки ще немає",
    description: string | null =
      "Вкажіть свій Minecraft нік, щоб приєднатися.";
  if (access === "banned") {
    title = "Доступ заблокований";
    description =
      "Для перегляду рішення зверніться до адміністрації в Discord.";
  } else if (access === "revoked") {
    title = "Доступ відкликано";
    description = "Ви можете подати заявку повторно.";
  } else if (access === "active") {
    title =
      data.synchronization === "completed"
        ? "Доступ відкрито"
        : "Схвалено, доступ синхронізується";
    description =
      data.synchronization === "completed"
        ? "Можна приєднуватися до сервера зі своїм ніком."
        : null;
  } else if (data.application?.status === "pending") {
    title = "Заявку передано адміністрації";
    description = "Очікуйте рішення. Статус оновлюється автоматично.";
  } else if (data.application?.status === "rejected") {
    title = "Заявку відхилено";
    description =
      data.application.rejectionReason ?? "Зверніться до адміністрації.";
  } else if (data.application?.status === "approved") {
    title = "Схвалено, доступ синхронізується";
    description = "Очікуємо підтвердження сервера.";
  } else if (data.application?.status === "cancelled") {
    title = "Заявку скасовано";
    description = "Ви можете подати нову заявку, якщо доступ не заблоковано.";
  }
  return (
    <section aria-live="polite">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {data.application && (
        <p>
          Нік: <strong>{data.application.minecraftUsername}</strong>
        </p>
      )}
    </section>
  );
}
