import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import {
  ABOUT_PATH,
  pageMetadata,
  SITE_NAME,
  SITE_SOCIALS,
  SITE_URL,
} from "@/lib/site";
import { SERVERS } from "@/features/servers/config";

const TITLE = "Український Minecraft-сервер і спільнота | Okrip World";
const DESCRIPTION =
  "Шукаєте український Minecraft-сервер чи українську майнкрафт-спільноту? Okrip World — україномовний ванільний сервер на Java 1.21 з вайтлістом, живою мапою та Discord.";

export const metadata: Metadata = pageMetadata(TITLE, DESCRIPTION, ABOUT_PATH);

const VANILLA = SERVERS.find((server) => server.id === "vanilla")!;
const VANILLA_ADDRESS = `${VANILLA.ip}:${VANILLA.port}`;

/** Питання з FAQ — і текст на сторінці, і розмітка FAQPage для пошуковиків. */
const FAQ = [
  {
    q: "Чи є український Minecraft-сервер, де всі спілкуються українською?",
    a: "Так. Okrip World — україномовний Minecraft-сервер: у грі, Discord і Telegram спільнота спілкується українською, а правила та сайт теж українською мовою.",
  },
  {
    q: "Яка IP-адреса сервера Okrip World?",
    a: `Адреса ванільного сервера — ${VANILLA_ADDRESS}. Додайте її в розділі «Мережева гра» в Minecraft Java Edition. Актуальна IP-адреса й порт завжди є на сторінці «Сервери».`,
  },
  {
    q: "Яку версію Minecraft підтримує сервер?",
    a: "Сервер працює на Minecraft Java Edition 1.21. Найзручніше заходити з тієї ж версії клієнта.",
  },
  {
    q: "Як потрапити на сервер — потрібна заявка?",
    a: "Так, сервер працює з вайтлістом. Увійдіть на сайті через Discord, подайте коротку заявку з ніком Minecraft — після схвалення модератором ваш нік додадуть у вайтліст автоматично.",
  },
  {
    q: "Чи це безкоштовний сервер без донату?",
    a: "Так, грати безкоштовно, і на сервері немає донату, що дає переваги в грі. Хостинг підтримується добровільними внесками спільноти.",
  },
  {
    q: "Чи є в спільноти Discord і Telegram?",
    a: "Так. Більша частина спілкування відбувається в Discord, а новини й анонси виходять також у Telegram-каналі Okrip World.",
  },
  {
    q: "Чи можна грати з Bedrock або з телефона?",
    a: "Зараз сервер розрахований на Minecraft Java Edition для ПК.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": new URL(ABOUT_PATH, SITE_URL).toString(),
      url: new URL(ABOUT_PATH, SITE_URL).toString(),
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "uk-UA",
      isPartOf: { "@id": `${SITE_URL}#website` },
      about: { "@id": `${SITE_URL}#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          item: SITE_URL.toString(),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Український Minecraft-сервер",
          item: new URL(ABOUT_PATH, SITE_URL).toString(),
        },
      ],
    },
  ],
};

export default function AboutServerPage() {
  return (
    <>
      <Nav />

      <main className="body">
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
          type="application/ld+json"
        />
        <div className="servers-wrap">
          <div className="servers-night-bg" />
          <div className="servers-day-bg" />

          <header className="page-header">
            <h1 className="page-title">Український Minecraft-сервер</h1>
            <p className="page-description">
              Okrip World — україномовна Minecraft-спільнота та ванільний сервер
              для тих, хто шукає, де пограти в майнкрафт з українцями.
            </p>
          </header>

          <article className="about-content">
            <section className="about-section">
              <h2>Українська майнкрафт-спільнота Okrip World</h2>
              <p>
                Якщо ви шукаєте українські Minecraft-сервери чи українські
                майнкрафт-спільноти, де можна спокійно грати й спілкуватися
                рідною мовою, — Okrip World створений саме для цього. Це
                спільнота українських гравців навколо ванільного сервера на
                Minecraft Java Edition: без зайвих плагінів, без «pay-to-win»
                донату, зі своїми правилами та модерацією.
              </p>
              <p>
                Ми граємо разом, будуємо міста й ферми, торгуємо, влаштовуємо
                події та спілкуємося в Discord і Telegram. Новачкам допомагають
                освоїтися, а досвідчені гравці знаходять тут команду для великих
                проєктів.
              </p>
            </section>

            <section className="about-section">
              <h2>Ванільне виживання (SMP) українською</h2>
              <p>
                Основний сервер — ванільний SMP: класичне виживання Minecraft
                1.21 без модифікацій ігрового процесу. Світ спільний для всіх
                гравців, тож ваші будівлі бачать сусіди, а на живій мапі можна
                стежити за розвитком світу прямо з браузера.
              </p>
              <ul>
                <li>Minecraft Java Edition 1.21</li>
                <li>Ванільне виживання без донатних переваг</li>
                <li>
                  Вайтліст і заявки через Discord — тільки перевірені гравці
                </li>
                <li>Жива мапа світу (Dynmap) на сайті</li>
                <li>Україномовні модератори та спільнота</li>
              </ul>
            </section>

            <section className="about-section">
              <h2>Як приєднатися до сервера</h2>
              <ol>
                <li>
                  Відкрийте сторінку <Link href="/servers">«Сервери»</Link> і
                  увійдіть через Discord.
                </li>
                <li>Подайте заявку, вказавши свій нік у Minecraft.</li>
                <li>
                  Після схвалення додайте сервер <code>{VANILLA_ADDRESS}</code>{" "}
                  у «Мережевій грі» та заходьте.
                </li>
              </ol>
              <p>
                <Link href="/servers" className="btn btn-primary">
                  IP-адреса та заявка →
                </Link>
              </p>
            </section>

            <section className="about-section">
              <h2>Чому обирають Okrip World серед українських серверів</h2>
              <p>
                Українських Minecraft-серверів небагато, а ще менше таких, де
                справді живе спільнота, а не лише онлайн-лічильник. Okrip World
                — це невеликий затишний сервер, де гравці знають одне одного, а
                вайтліст захищає світ від грифінгу. Хостинг оплачує сама
                спільнота, тож тут немає реклами й платних привілеїв.
              </p>
            </section>

            <section className="about-section">
              <h2>Часті питання</h2>
              <div className="about-faq">
                {FAQ.map(({ q, a }) => (
                  <details key={q}>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="about-section">
              <h2>Спільнота в соцмережах</h2>
              <ul>
                {SITE_SOCIALS.map((url) => (
                  <li key={url}>
                    <a href={url} rel="noopener noreferrer" target="_blank">
                      {url.replace(/^https:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </article>
        </div>
      </main>
    </>
  );
}
