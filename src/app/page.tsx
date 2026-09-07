import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Mascot } from "@/components/mascot";
import { SocialLinks } from "@/components/social-links";
import { HomeStatOnline } from "@/components/home-stat-online";

export const metadata: Metadata = {
  title: "Okrip World",
};

export default function HomePage() {
  return (
    <>
      <Nav />

      <div className="body">
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
            Два сервери — один дім.
          </p>
          <div className="home-actions">
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
              <span className="stat-num">2</span>
              <span className="stat-label">Сервери</span>
            </div>
            <div className="stat">
              <span className="stat-num">1.21.11</span>
              <span className="stat-label">Версія</span>
            </div>
          </div>
          <SocialLinks />
        </div>
      </div>

      <Mascot />
    </>
  );
}
