"use client";

import type { ReactNode } from "react";
import { useCurrentSession } from "@/features/auth/hooks/useCurrentSession";

/** Показує вміст лише адміністрації сайту (модераторам і вище). */
export function AdminOnly({ children }: { children: ReactNode }) {
  const session = useCurrentSession();
  if (!session.data?.user?.isAdmin) return null;
  return children;
}
