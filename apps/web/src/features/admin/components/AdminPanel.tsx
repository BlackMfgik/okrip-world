"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApplicationListSchema,
  adminDecisionResultSchema,
  type AdminApplicationFilter,
  type AdminApplicationList,
  type AdminDecision,
} from "@okrip/contracts";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { WhitelistPanel } from "./WhitelistPanel";

const filters: Array<{ value: AdminApplicationFilter; label: string }> = [
  { value: "all", label: "Усі" },
  { value: "pending", label: "Очікують" },
  { value: "approved", label: "Схвалені" },
  { value: "rejected", label: "Відхилені" },
  { value: "cancelled", label: "Скасовані" },
];

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
  }).format(new Date(value));
}

export function AdminPanel() {
  const session = useCurrentSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AdminApplicationFilter>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [section, setSection] = useState<"applications" | "whitelist">(
    "applications",
  );

  const applications = useQuery({
    queryKey: queryKeys.adminApplications(filter),
    queryFn: () =>
      apiRequest(
        `/admin/applications?status=${filter}`,
        adminApplicationListSchema,
      ),
    enabled: session.data?.user?.isAdmin === true && section === "applications",
  });

  const decision = useMutation({
    mutationFn: (body: AdminDecision) =>
      apiRequest(
        "/admin/applications/decision",
        adminDecisionResultSchema,
        body,
      ),
    onSuccess: async () => {
      setRejecting(null);
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminApplicationsRoot,
      });
    },
  });

  if (session.isPending)
    return <p className="admin-state">Перевіряємо права доступу…</p>;
  if (session.error)
    return (
      <div className="admin-state" role="alert">
        <p>{session.error.message}</p>
        <button className="btn" onClick={() => void session.refetch()}>
          Повторити
        </button>
      </div>
    );
  if (!session.data?.user?.isAdmin)
    return (
      <section className="admin-state admin-denied">
        <p className="application-eyebrow">OKRIP WORLD</p>
        <h1>Сторінка недоступна</h1>
        <p>Цей розділ відкритий лише адміністраторам.</p>
        <Link href="/" className="btn btn-primary">
          На головну
        </Link>
      </section>
    );

  const data: AdminApplicationList | undefined = applications.data;

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <nav className="admin-sections" aria-label="Розділи адмін-панелі">
          <button
            className={section === "applications" ? "is-active" : undefined}
            onClick={() => setSection("applications")}
            type="button"
          >
            Заявки
          </button>
          <button
            className={section === "whitelist" ? "is-active" : undefined}
            onClick={() => setSection("whitelist")}
            type="button"
          >
            Вайтліст
          </button>
        </nav>
        <div className="admin-identity">
          <span>Адміністратор</span>
          <strong>
            {session.data.user.displayName ?? session.data.user.username}
          </strong>
        </div>
      </header>

      {section === "whitelist" ? (
        <WhitelistPanel />
      ) : (
        <>
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
              <button
                className="btn"
                onClick={() => void applications.refetch()}
              >
                Спробувати ще раз
              </button>
            </div>
          )}
          {decision.error && (
            <p className="admin-action-error" role="alert">
              {decision.error.message}
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
              <article
                className="admin-application-card"
                key={application.publicId}
              >
                <header>
                  <div>
                    <span className="admin-application-number">
                      Заявка №{application.number}
                    </span>
                    <h2>{application.minecraftUsername}</h2>
                  </div>
                  <span
                    className={`admin-status admin-status-${application.status}`}
                  >
                    {statusLabels[application.status]}
                  </span>
                </header>

                <dl className="admin-application-details">
                  <div>
                    <dt>Discord</dt>
                    <dd>
                      {application.discordDisplayName ??
                        application.discordUsername}
                      <small>@{application.discordUsername}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Подано</dt>
                    <dd>{formatDate(application.createdAt)}</dd>
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
                          onClick={() => {
                            if (
                              window.confirm(
                                `Схвалити заявку ${application.minecraftUsername}?`,
                              )
                            )
                              decision.mutate({
                                publicId: application.publicId,
                                action: "approve",
                              });
                          }}
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
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
