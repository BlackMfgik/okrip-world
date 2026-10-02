import ServersPage from "@/app/servers/page";
import { LoginErrorDialog } from "@/features/auth/components/LoginErrorDialog";

export const metadata = {
  title: "Вхід через Discord",
  robots: { index: false, follow: false },
};

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <ServersPage />
      <LoginErrorDialog reason={typeof error === "string" ? error : undefined} />
    </>
  );
}
