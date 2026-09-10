import type { CurrentApplication } from "@okrip/contracts";
export function ApplicationStatus({ data }: { data: CurrentApplication }) {
  let title = "Заявки ще немає",
    description = "Вкажіть свій Minecraft Java нік, щоб приєднатися.";
  if (data.access === "banned") {
    title = "Доступ заблокований";
    description =
      "Для перегляду рішення зверніться до адміністрації в Discord.";
  } else if (data.access === "revoked") {
    title = "Доступ відкликано";
    description = "Зверніться до адміністрації для відновлення доступу.";
  } else if (data.access === "active") {
    title =
      data.synchronization === "completed"
        ? "Доступ відкрито"
        : "Схвалено, доступ синхронізується";
    description =
      data.synchronization === "completed"
        ? "Можна приєднуватися до сервера зі своїм ніком."
        : "Сервер отримає зміни автоматично. Сторінка оновлюється сама.";
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
      <p>{description}</p>
      {data.application && (
        <p>
          Нік: <strong>{data.application.minecraftUsername}</strong>
        </p>
      )}
    </section>
  );
}
