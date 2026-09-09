import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavOnline } from "@/components/nav-online";

interface NavProps {
  staticOnline?: string;
}

export function Nav({ staticOnline }: NavProps) {
  return (
    <nav className="nav" aria-label="Основна навігація">
      <Link href="/" className="nav-logo">
        OKRIP WORLD
      </Link>
      {staticOnline ? (
        <span className="nav-online">{staticOnline}</span>
      ) : (
        <NavOnline />
      )}
      <ThemeToggle />
    </nav>
  );
}
