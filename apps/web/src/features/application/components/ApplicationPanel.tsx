"use client";
import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { useCurrentApplication } from "../hooks/useCurrentApplication";
import { ApplicationForm } from "./ApplicationForm";
import { ApplicationStatus } from "./ApplicationStatus";
export function ApplicationPanel() {
  const session = useCurrentSession(),
    application = useCurrentApplication(!!session.data?.user),

    client = useQueryClient();
  const [logoutError, setLogoutError] = useState("");

  if (session.isPending) return <p role="status">Перевіряємо вхід…</p>;
  if (session.error)
    return (
      <p role="alert">
        {session.error.message}{" "}
        <button onClick={() => void session.refetch()}>Повторити</button>
      </p>
    );
  if (!session.data?.user) return null;
  const data = application.data;
  return (
    <>
      <p>
        Ви увійшли як{" "}
        <strong>
          {session.data.user.displayName ?? session.data.user.username}
        </strong>
      </p>
      {application.isPending && <p role="status">Завантажуємо заявку…</p>}
      {application.error && (
        <p role="alert">
          {application.error.message}{" "}
          <button onClick={() => void application.refetch()}>Повторити</button>
        </p>
      )}
      {data && (
        <>
          <ApplicationStatus data={data} />
          {data.repeatSubmissionEnabled && (
            <p role="status">Режим відладки: повторні заявки дозволені.</p>
          )}
          {(data.repeatSubmissionEnabled ||
            (!data.access &&
              (!data.application ||
                ["rejected", "cancelled"].includes(
                  data.application.status,
                )))) && (
              <ApplicationForm />
            )}
        </>
      )}
      {logoutError && <p role="alert">{logoutError}</p>}
      <button
        className="btn"
        onClick={async () => {
          try {
            const response = await fetch("/v1/auth/logout", { method: "POST" });
            if (!response.ok) throw new Error();
            client.clear();

          } catch {
            setLogoutError("Не вдалося вийти. Спробуйте ще раз.");
          }
        }}
      >
        Вийти
      </button>
    </>
  );
}

