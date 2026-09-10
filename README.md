# Okrip World

Сайт і система верифікації: Discord OAuth → заявка з Minecraft-ніком → Telegram-модерація → надійна доставка whitelist-команди на Paper/Purpur.

Наявний сайт, BlueMap, сторінки серверів і перемикання теми збережено в `apps/web`. Zustand використовується лише для наявного UI; дані верифікації зберігає TanStack Query.

## Структура

- `apps/web` — Next.js 15 / React 19, сторінка заявки, серверний проксі браузерного API.
- `apps/api` — Fastify, Discord, Telegram webhook і worker в одному процесі, PostgreSQL/Drizzle.
- `packages/contracts` — публічні Zod DTO, без DB-рядків.
- `apps/minecraft-plugin` — Java 21, Paper/Purpur 1.21.11, Gradle wrapper.

## Локальний запуск

Потрібні Node.js 24, pnpm 11.19.0, PostgreSQL 17; Java 21 для плагіна.

1. `pnpm install --frozen-lockfile`.
2. Скопіюйте `.env.example` у `.env`, заповніть інтеграції та згенеруйте окремі випадкові секрети. Приклади не є production-секретами.
3. `docker compose up -d postgres` або використайте власний локальний PostgreSQL.
4. Експортуйте змінні `.env` у shell і виконайте `pnpm db:migrate`. Альтернатива без експорту: з `apps/api` виконайте `node --env-file=../../.env --import tsx src/db/migrate.ts`.
5. Для web додайте `API_INTERNAL_URL=http://localhost:3001` і той самий `WEB_PROXY_SECRET` у `apps/web/.env.local`. API dev читає кореневий `.env`.
6. `pnpm --filter @okrip/contracts build`, потім `pnpm dev`. Сайт: http://localhost:3000.

Discord redirect у development: `http://localhost:3000/v1/auth/discord/callback`. Telegram потребує доступного HTTPS webhook; не використовуйте production-бота для локальних тестів.

## Перевірки

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

Java: з `apps/minecraft-plugin` — `./gradlew build` (Windows: `.\gradlew.bat build`). Вкажіть Java 21 у JAVA_HOME. JAR: `apps/minecraft-plugin/build/libs/OkripWhitelist.jar`.

API-тести за замовчуванням виконують SQL-міграції в PGlite, без облікових даних зовнішніх сервісів. CI запускає ці ж тести на PostgreSQL 17, включно з конкурентними транзакціями. Для такого запуску локально задайте TEST_DATABASE_URL до окремої БД, назва якої закінчується на `_test`, з правом CREATE DATABASE. Кожен тест створює та прибирає власну випадково названу БД. Не задавайте production URL.

## Документація

- [Розгортання Railway/Kinetic](docs/DEPLOYMENT.md)
- [Контракт API](docs/API_CONTRACT.md)
- [Стани та гарантії доставки](docs/STATE_MACHINES.md)
- [Безпека та обмеження](docs/SECURITY.md)

Живі Discord/Telegram/Railway/Kinetic інтеграції потребують ваших налаштувань. Локальні автоматичні перевірки не замінюють фінальний smoke test на цільовому Minecraft-сервері. Для offline-mode обов'язковий AuthMe або інший захист від входу під чужим ніком.
