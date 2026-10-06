"use client";
import type {
  AdminApplicationFilter,
  AdminApplicationList,
} from "@okrip/contracts";
import { useAdminApplications } from "../hooks/useAdminApplications";
import { AdminApplicationCard } from "./AdminApplicationCard";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
const filters: Array<{ value: AdminApplicationFilter; label: string }> = [
  { value: "pending", label: "Очікують" },
  { value: "approved", label: "Схвалені" },
  { value: "rejected", label: "Відхилені" },
  { value: "cancelled", label: "Скасовані" },
  { value: "blocked", label: "Заблоковані" },
];

export function AdminApplicationsPanel({ active }: { active: boolean }) {
  const {
    filter,
    setFilter,
    rejecting,
    setRejecting,
    reason,
    setReason,
    blockConfirmation,
    setBlockConfirmation,
    approveConfirmation,
    setApproveConfirmation,
    applications,
    decision,
    applicationBlock,
  } = useAdminApplications(active);
  const data: AdminApplicationList | undefined = applications.data;
  return (
    <div hidden={!active}>
      <nav className="admin-filters" aria-label="Фільтр заявок">
        {filters.map((item) => (
          <button
            key={item.value}
            className={filter === item.value ? "is-active" : undefined}
            onClick={() => setFilter(item.value)}
            type="button"
          >
            {item.label}
            <span>{data?.counts[item.value] ?? "—"}</span>
          </button>
        ))}
      </nav>

      {applications.isPending && (
        <p className="admin-state" role="status">
          Завантажуємо заявки…
        </p>
      )}
      {applications.error && (
        <div className="admin-state" role="alert">
          <p>{applications.error.message}</p>
          <button className="btn" onClick={() => void applications.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      )}
      {decision.error && (
        <p className="admin-action-error" role="alert">
          {decision.error.message}
        </p>
      )}
      {applicationBlock.error && (
        <p className="admin-action-error" role="alert">
          {applicationBlock.error.message}
        </p>
      )}

      {data?.applications.length === 0 && (
        <div className="admin-empty">
          <span>✓</span>
          <h2>Тут поки порожньо</h2>
          <p>Заявок із таким статусом немає.</p>
        </div>
      )}

      <div className="admin-applications">
        {data?.applications.map((application) => (
          <AdminApplicationCard
            key={application.publicId}
            application={application}
            rejecting={rejecting}
            setRejecting={setRejecting}
            reason={reason}
            setReason={setReason}
            decision={decision}
            applicationBlock={applicationBlock}
            setApproveConfirmation={setApproveConfirmation}
            setBlockConfirmation={setBlockConfirmation}
          />
        ))}
      </div>
      {approveConfirmation && (
        <AdminConfirmDialog
          confirmLabel="Схвалити"
          description={
            approveConfirmation.minecraftUsername +
            " отримає доступ до сервера — нік буде додано до вайтліста."
          }
          eyebrow="РОЗГЛЯД ЗАЯВКИ"
          onCancel={() => setApproveConfirmation(null)}
          onConfirm={() =>
            decision.mutate(
              { publicId: approveConfirmation.publicId, action: "approve" },
              { onSettled: () => setApproveConfirmation(null) },
            )
          }
          pending={decision.isPending}
          title={
            "Схвалити заявку " + approveConfirmation.minecraftUsername + "?"
          }
          tone="success"
        />
      )}
      {blockConfirmation && (
        <AdminConfirmDialog
          confirmLabel={
            blockConfirmation.durationMinutes
              ? "Нєт іді нахуй"
              : blockConfirmation.blocked
                ? "Заблокувати"
                : "Розблокувати"
          }
          description={
            blockConfirmation.durationMinutes
              ? blockConfirmation.minecraftUsername +
                " не зможе надсилати заявки протягом однієї години. Після цього доступ відновиться автоматично."
              : blockConfirmation.blocked
                ? blockConfirmation.minecraftUsername +
                  " не зможе надсилати нові заявки, доки адміністратор не зніме блокування."
                : blockConfirmation.minecraftUsername +
                  " знову зможе надсилати заявки на сервер."
          }
          onCancel={() => setBlockConfirmation(null)}
          onConfirm={() =>
            applicationBlock.mutate({
              publicId: blockConfirmation.publicId,
              blocked: blockConfirmation.blocked,
              ...(blockConfirmation.durationMinutes
                ? { durationMinutes: blockConfirmation.durationMinutes }
                : {}),
            })
          }
          pending={applicationBlock.isPending}
          title={
            blockConfirmation.durationMinutes
              ? "Таймаут на одну годину"
              : blockConfirmation.blocked
                ? "Заблокувати користувача?"
                : "Розблокувати користувача?"
          }
          tone={
            blockConfirmation.durationMinutes
              ? "hour"
              : blockConfirmation.blocked
                ? "danger"
                : "neutral"
          }
        />
      )}
    </div>
  );
}
