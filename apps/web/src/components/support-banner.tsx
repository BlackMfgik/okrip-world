import { SITE_SUPPORT_URL } from "@/lib/site";

/** Блок донату на сервер. Не показується, поки не задано посилання на банку. */
export function SupportBanner() {
  if (!SITE_SUPPORT_URL) return null;
  return (
    <aside className="support-banner" aria-labelledby="support-banner-title">
      <div className="support-banner-icon" aria-hidden="true">
        💛
      </div>
      <div className="support-banner-text">
        <h2 id="support-banner-title">Підтримай сервер</h2>
        <p>Хостинг оплачуємо самі, тож кожна гривня допомагає серверу жити.</p>
      </div>
      <a
        className="btn btn-primary support-banner-button"
        href={SITE_SUPPORT_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        На банку →
      </a>
    </aside>
  );
}
