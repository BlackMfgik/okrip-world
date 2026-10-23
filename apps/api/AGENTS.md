# Правила API

Доповнюють кореневий `AGENTS.md`. Перед змінами в заявках, доступі чи черзі
команд прочитай `docs/ARCHITECTURE.md` і `docs/STATE_MACHINES.md`; у
сесіях, OAuth, проксі чи логуванні — `docs/SECURITY.md`.

```text
src/app.ts          збирає сервіси й маршрути через публічні index.ts модулів
src/server.ts       запуск сервера й Telegram-worker
src/config/env.ts   валідація environment (Zod)
src/modules/<name>/ auth, applications, moderation, player-access,
                    command-queue, admin, minecraft, discord, audit
src/plugins/        сесія, rate limit
src/shared/         crypto, errors, http, Discord-допоміжні функції
src/db/             Drizzle-схема (schema/*.ts), client, migrate, migrations/
test/               інтеграційні тести; test-database.ts — PGlite або _test БД
```

- Інший модуль імпортує лише `index.js` модуля, не його `*.repository` чи
  `*.service` (ESLint це забороняє). Routes — HTTP і перевірка доступу;
  services — бізнес-сценарій; repositories — запити до БД.
- Транзакцією володіє бізнес-сценарій; вкладені операції приймають той самий
  `tx`. Перед змінами заявок і доступу блокуй рядок `users`.
- Вхід і вихід маршрутів валідуються схемами з `@okrip/contracts`. Помилки —
  `{ code, message }` без stack trace; персональні відповіді — `no-store`.
  Не повертай браузеру внутрішні UUID, Telegram ID, токени чи DB-рядки.
- Не логуй URL запиту, cookie та authorization.
- Схему БД змінюй у `src/db/schema/`, міграцію генеруй
  `pnpm --filter @okrip/api db:generate` і перевір SQL. Застосовані міграції
  (`0000`–`0018` і новіші) не редагуй — лише нова міграція. Міграція має
  бути сумісною з поточною версією API, що ще працює під час розгортання.
- Плагін приймає лише типізовані дії черги команд; не додавай довільних
  console/RCON-команд.
- Зовнішні виклики Discord/Telegram мають таймаут і не блокують розгляд
  заявки при відмові.

Команди: `pnpm --filter @okrip/api test` (PGlite; для справжньої БД задай
`TEST_DATABASE_URL`, назва бази має закінчуватися на `_test`),
`pnpm --filter @okrip/api typecheck`, `lint`, `build`. `pnpm dev` читає
`../../.env`. У продакшні міграції виконує Railway preDeploy
(`db:migrate`), healthcheck — `/ready`, одна репліка.

Документація:

- Fastify: https://fastify.dev/docs/latest/
- @fastify/rate-limit: https://github.com/fastify/fastify-rate-limit
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Міграції Drizzle: https://orm.drizzle.team/docs/migrations
- PostgreSQL 17: https://www.postgresql.org/docs/17/
- PGlite: https://pglite.dev/docs/
- Discord API (snowflake, guild member): https://docs.discord.com/developers/reference
- Telegram Bot API: https://core.telegram.org/bots/api
