import ServersPage from "@/app/servers/page";
import { LoginErrorDialog } from "@/features/auth/components/LoginErrorDialog";

export const metadata = {
  title: "Вхід через Discord — Okrip World",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <>
      <ServersPage />
      <LoginErrorDialog />
    </>
  );
}
