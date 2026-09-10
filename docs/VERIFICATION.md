# Локальна перевірка

Перевірено 2026-09-10:

- pnpm typecheck — успішно.
- pnpm lint — успішно.
- pnpm build — contracts, API та production Next.js успішно.
- pnpm test — 19 API-тестів у PGlite та 5 наявних web-тестів успішно.
- Gradle build — JAR зібрано, 2 Java-тести журналу пройшли. На Windows Java-тестам знадобився дозволений доступ до тимчасової папки.
- Production Next.js запущено локально; головна та сторінка заявки відкриваються в браузері. Без інтеграцій показано зрозумілу помилку «Авторизацію ще не налаштовано».

CI налаштовано на PostgreSQL 17; цей CI-run локально не виконувався. Docker-образи та реальні Discord/Telegram/Railway/Kinetic credentials у цій перевірці не використовувалися. Потрібен описаний у DEPLOYMENT.md smoke test на цільовій інфраструктурі.
