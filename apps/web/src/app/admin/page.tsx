import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { AdminPanel } from "@/features/admin/components/AdminPanel";

export const metadata: Metadata = {
  title: "Адмін-панель",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <Nav />
      <main className="body admin-page">
        <div className="servers-night-bg" />
        <div className="servers-day-bg" />
        <AdminPanel />
      </main>
    </>
  );
}
