"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { useCurrentApplication } from "../hooks/useCurrentApplication";
import { ApplicationForm } from "./ApplicationForm";
import { ApplicationStatus } from "./ApplicationStatus";
export function ApplicationPanel() {
  const session = useCurrentSession(),
    application = useCurrentApplication(!!session.data?.user),
    router = useRouter(),
    client = useQueryClient();
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    if (session.data && !session.data.user) router.replace("/");
  }, [session.data, router]);
  if (session.isPending) return <p role="status">Перевіряємо вхід…</p>;
  if (session.error)
    return (
      <p role="alert">
        {session.error.message}{" "}
        <button onClick={() => void session.refetch()}>Повторити</button>
      </p>
    );
  if (!session.data?.user) return <p>Повертаємо на головну…</p>;
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
          {!data.access &&
            (!data.application ||
              ["rejected", "cancelled"].includes(data.application.status)) && (
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
            router.replace("/");
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
