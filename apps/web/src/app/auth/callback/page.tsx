import { DiscordLoginButton } from "@/features/auth/components/DiscordLoginButton";
export default function AuthCallbackPage() {
  return (
    <main className="verification">
      <h1>Не вдалося завершити вхід</h1>
      <p>
        Переконайтеся, що ви приєдналися до Discord-сервера Okrip World і
        завершили перевірку учасника, та спробуйте ще раз.
      </p>
      <DiscordLoginButton />
    </main>
  );
}
