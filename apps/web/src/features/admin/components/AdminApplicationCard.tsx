"use client";
import type { AdminApplicationList } from "@okrip/contracts";
import type { useAdminApplications } from "../hooks/useAdminApplications";
import { DiscordAvatar } from "./DiscordAvatar";
const statusLabels = {
  pending: "Очікує рішення",
  approved: "Схвалено",
  rejected: "Відхилено",
  cancelled: "Скасовано",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

function DiscordDate({ value }: { value: string | null }) {
  return value ? (
    <time dateTime={value}>{formatDate(value)}</time>
  ) : (
    <>Немає даних</>
  );
}

type Props = Pick<
  ReturnType<typeof useAdminApplications>,
  | "rejecting"
  | "setRejecting"
  | "reason"
  | "setReason"
  | "decision"
  | "applicationBlock"
  | "setApproveConfirmation"
  | "setBlockConfirmation"
> & {
  application: AdminApplicationList["applications"][number];
};

export function AdminApplicationCard({
  application,
  rejecting,
  setRejecting,
  reason,
  setReason,
  decision,
  applicationBlock,
  setApproveConfirmation,
  setBlockConfirmation,
}: Props) {
  return (
    <article className="admin-application-card">
      <header>
        <div className="admin-application-player">
          <DiscordAvatar
            name={application.minecraftUsername}
            url={application.discordAvatarUrl}
          />
          <div>
            <span className="admin-application-number">
              Заявка №{application.number}
            </span>
            <h2>{application.minecraftUsername}</h2>
          </div>
        </div>
        <div className="admin-card-statuses">
          <span className={`admin-status admin-status-${application.status}`}>
            {statusLabels[application.status]}
          </span>
          {application.applicationBlocked && (
            <span className="admin-user-blocked">
              {application.applicationBlockedUntil
                ? "Блок до " + formatDate(application.applicationBlockedUntil)
                : "Заблоковано"}
            </span>
          )}
        </div>
      </header>

      <dl className="admin-application-details">
        <div>
          <dt>Discord</dt>
          <dd>
            {application.discordDisplayName ?? application.discordUsername}
            <small>@{application.discordUsername}</small>
          </dd>
        </div>
        <div>
          <dt>Подано</dt>
          <dd>{formatDate(application.createdAt)}</dd>
        </div>
        <div>
          <dt>Акаунт Discord створено</dt>
          <dd>
            <DiscordDate value={application.discordAccountCreatedAt} />
          </dd>
        </div>
        <div>
          <dt>Приєднався до Discord-сервера</dt>
          <dd>
            <DiscordDate value={application.discordGuildJoinedAt} />
          </dd>
        </div>
        {application.reviewerName && (
          <div>
            <dt>Рішення прийняв</dt>
            <dd>{application.reviewerName}</dd>
          </div>
        )}
      </dl>

      {application.rejectionReason && (
        <p className="admin-rejection-reason">
          <span>Причина відмови</span>
          {application.rejectionReason}
        </p>
      )}

      {application.status === "pending" && (
        <div className="admin-actions">
          {rejecting === application.publicId ? (
            <form
              className="admin-reject-form"
              onSubmit={(event) => {
                event.preventDefault();
                decision.mutate({
                  publicId: application.publicId,
                  action: "reject",
                  rejectionReason: reason,
                });
              }}
            >
              <label htmlFor={`reason-${application.publicId}`}>
                Причина відмови
              </label>
              <textarea
                id={`reason-${application.publicId}`}
                maxLength={256}
                minLength={1}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Коротко поясніть рішення гравцю"
                required
                rows={3}
                value={reason}
              />
              <div>
                <button
                  className="admin-button admin-button-danger"
                  disabled={decision.isPending}
                  type="submit"
                >
                  {decision.isPending ? "Зберігаємо…" : "Відхилити"}
                </button>
                <button
                  className="admin-button admin-button-ghost"
                  disabled={decision.isPending}
                  onClick={() => {
                    setRejecting(null);
                    setReason("");
                  }}
                  type="button"
                >
                  Скасувати
                </button>
              </div>
            </form>
          ) : (
            <>
              <button
                className="admin-button admin-button-success"
                disabled={decision.isPending}
                onClick={() =>
                  setApproveConfirmation({
                    publicId: application.publicId,
                    minecraftUsername: application.minecraftUsername,
                  })
                }
                type="button"
              >
                Схвалити
              </button>
              <button
                className="admin-button admin-button-danger"
                disabled={decision.isPending}
                onClick={() => {
                  setRejecting(application.publicId);
                  setReason("");
                }}
                type="button"
              >
                Відхилити
              </button>
            </>
          )}
        </div>
      )}
      <div className="admin-user-controls">
        <button
          className={`admin-button ${
            application.applicationBlocked
              ? "admin-button-ghost"
              : "admin-button-danger"
          }`}
          disabled={applicationBlock.isPending}
          onClick={() => {
            const blocked = !application.applicationBlocked;
            setBlockConfirmation({
              publicId: application.publicId,
              minecraftUsername: application.minecraftUsername,
              blocked,
            });
          }}
          type="button"
        >
          {application.applicationBlocked
            ? "Розблокувати заявки"
            : "Заблокувати користувача"}
        </button>
        <button
          className="admin-button admin-button-hour"
          disabled={
            applicationBlock.isPending || application.applicationBlocked
          }
          onClick={() => {
            setBlockConfirmation({
              publicId: application.publicId,
              minecraftUsername: application.minecraftUsername,
              blocked: true,
              durationMinutes: 60,
            });
          }}
          type="button"
        >
          Нєт іді нахуй
        </button>
      </div>
    </article>
  );
}
