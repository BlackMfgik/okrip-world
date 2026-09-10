import { DiscordLoginButton } from '@/features/auth/components/DiscordLoginButton';
import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Mascot } from "@/components/mascot";
import { SocialLinks } from "@/components/social-links";
import { HomeStatOnline } from "@/components/home-stat-online";
import { pageMetadata, SITE_DESCRIPTION } from "@/lib/site";
import { SERVERS } from "@/lib/servers";

export const metadata: Metadata = pageMetadata(
  "Okrip World — Українська Minecraft-спільнота",
  SITE_DESCRIPTION,
  "/",
);

export default function HomePage() {
  return (
    <>
      <Nav />

      <main className="body">
        <div className="home-wrap">
          <div className="home-grid" />
          <div className="home-night-bg" />
          <div className="home-day-bg" />

          <div className="home-eyebrow">Minecraft Network</div>
          <h1 className="home-title">
            OKRIP
            <br />
            <span>WORLD</span>
          </h1>
          <p className="home-sub">
            Українська Minecraft-спільнота.
            <br />
            Ванільний сервер — один дім.
          </p>
          <p className="home-verification">Увійдіть через Discord, вкажіть Minecraft-нік і дочекайтеся рішення адміністрації.</p>
          <div className="home-actions">
            <DiscordLoginButton />
            <Link href="/application" className="btn">Моя заявка</Link>
            <Link href="/servers" className="btn btn-primary">
              Обрати сервер →
            </Link>
          </div>
          <div className="home-stats">
            <div className="stat">
              <HomeStatOnline />
              <span className="stat-label">Онлайн</span>
            </div>
            <div className="stat">
              <span className="stat-num">{SERVERS.length}</span>
              <span className="stat-label">{SERVERS.length === 1 ? "Сервер" : "Сервери"}</span>
            </div>
            <div className="stat">
              <span className="stat-num">1.21.11</span>
              <span className="stat-label">Версія</span>
            </div>
          </div>
          <SocialLinks />
        </div>
      </main>

      <Mascot />
    </>
  );
}
