"use client";
import { useState } from "react";
import { useSubmitApplication } from "../hooks/useSubmitApplication";
export function ApplicationForm() {
  const [minecraftUsername, setUsername] = useState("");
  const submit = useSubmitApplication();
  return (
    <form
      className="verification-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate({ minecraftUsername });
      }}
    >
      <label htmlFor="minecraft-username">Minecraft нік</label>
      <input
        id="minecraft-username"
        value={minecraftUsername}
        onChange={(e) => setUsername(e.target.value)}
        required
        minLength={3}
        maxLength={16}
        pattern="[A-Za-z0-9_]{3,16}"
        autoComplete="off"
        aria-describedby="nickname-help"
        disabled={submit.isPending}
      />
      <p id="nickname-help">
        3–16 символів: латинські літери, цифри та _. Перевірте нік: для його
        зміни потрібно буде звернутися до адміністрації.
      </p>
      {submit.error && <p role="alert">{submit.error.message}</p>}
      <button
        className="btn btn-primary"
        disabled={submit.isPending}
        type="submit"
      >
        {submit.isPending ? "Надсилаємо…" : "Подати заявку"}
      </button>
    </form>
  );
}
