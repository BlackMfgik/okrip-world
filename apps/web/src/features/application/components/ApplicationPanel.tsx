"use client";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";
import { useCurrentApplication } from "../hooks/useCurrentApplication";
import { ApplicationForm } from "./ApplicationForm";
import { ApplicationCooldown } from "./ApplicationCooldown";
import { ApplicationStatus } from "./ApplicationStatus";
import { ReapplyButton } from "./ReapplyButton";
import { effectiveAccess } from "../effective-access";
export function ApplicationPanel() {
  const session = useCurrentSession();
  const application = useCurrentApplication(!!session.data?.user);

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
  const access = effectiveAccess(data);
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
          {data.nextSubmissionAt && (
            <ApplicationCooldown until={data.nextSubmissionAt} />
          )}
          {data.repeatSubmissionEnabled && (
            <p role="status">Режим відладки: повторні заявки дозволені.</p>
          )}
          {/* Після відкликання доступу (і якщо повторну заявку відхилили) нік уже прив'язаний — лише кнопка. */}
          {!data.nextSubmissionAt &&
          data.access === "revoked" &&
          data.application &&
          data.application.status !== "pending" &&
          !data.repeatSubmissionEnabled ? (
            <ReapplyButton
              minecraftUsername={data.application.minecraftUsername}
            />
          ) : (
            !data.nextSubmissionAt &&
            (data.repeatSubmissionEnabled ||
              (!access &&
                (!data.application ||
                  ["rejected", "cancelled"].includes(
                    data.application.status,
                  )))) && <ApplicationForm />
          )}
        </>
      )}
    </>
  );
}
