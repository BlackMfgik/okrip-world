import { Nav } from "@/components/nav";
import { ApplicationPanel } from "@/features/application/components/ApplicationPanel";
export const metadata = {
  title: "Заявка — Okrip World",
  robots: { index: false, follow: false },
};
export default function ApplicationPage() {
  return (
    <>
      <Nav />
      <main className="verification">
        <h1>Приєднатися до Okrip World</h1>
        <ApplicationPanel />
      </main>
    </>
  );
}
