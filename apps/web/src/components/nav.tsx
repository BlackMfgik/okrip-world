import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavOnline } from "@/components/nav-online";
import { AdminNavLink } from "@/features/admin/components/AdminNavLink";
import { AccountMenu } from "@/features/auth/components/AccountMenu";

interface NavProps {
  staticOnline?: string;
}

export function Nav({ staticOnline }: NavProps) {
  return (
    <>
      <nav className="nav" aria-label="Основна навігація">
        <Link href="/" className="nav-logo">
          OKRIP WORLD
        </Link>
        {staticOnline ? (
          <span className="nav-online">{staticOnline}</span>
        ) : (
          <NavOnline />
        )}
        <AdminNavLink />
        <ThemeToggle />
      </nav>
      <AccountMenu />
    </>
  );
}
