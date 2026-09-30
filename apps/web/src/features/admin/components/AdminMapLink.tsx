"use client";

import Link from "next/link";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";

/** Кнопка мапи сервера, що ще готується: адмінам — робоче посилання, решті — «скоро». */
export function AdminMapLink({ href, name }: { href: string; name: string }) {
  const session = useCurrentSession();
  if (!session.data?.user?.isAdmin)
    return (
      <button className="btn btn-map" disabled type="button">
        Мапа — скоро
      </button>
    );
  return (
    <Link href={href} className="btn btn-map" aria-label={`Мапа сервера ${name}`}>
      Мапа →
    </Link>
  );
}
