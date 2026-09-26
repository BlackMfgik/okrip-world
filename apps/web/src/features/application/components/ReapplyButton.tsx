"use client";
import { useSubmitApplication } from "../hooks/useSubmitApplication";

/** Повторна заявка після відкликання доступу: нік не вводиться, береться прив'язаний (його змінює лише адмін). */
export function ReapplyButton({ minecraftUsername }: { minecraftUsername: string }) {
  const submit = useSubmitApplication();
  return (
    <div className="verification-form">
      {submit.error && <p role="alert">{submit.error.message}</p>}
      <button
        className="btn btn-primary"
        disabled={submit.isPending}
        onClick={() => submit.mutate({ minecraftUsername })}
        type="button"
      >
        {submit.isPending ? "Надсилаємо…" : "Подати заявку повторно"}
      </button>
    </div>
  );
}
