"use client";

import Link from "next/link";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";

export function AdminNavLink() {
  const session = useCurrentSession();
  if (!session.data?.user?.isAdmin) return null;
  return (
    <Link href="/admin" className="nav-admin-link">
      Адмін
    </Link>
  );
}
