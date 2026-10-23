# Правила вебзастосунку

Доповнюють кореневий `AGENTS.md`. Next.js 15 App Router, React 19,
TypeScript, Tailwind 3, TanStack Query, Zustand.

```text
src/app/            маршрути й layouts; v1/[...path] — проксі до API,
                    dynmap*/[...path] — Dynmap-проксі, health — healthcheck
src/features/       auth, application, admin, servers, maps
                    (<feature>/components, <feature>/hooks, maps/server)
src/components/     спільний UI без знання домену (nav, toast, theme-toggle…)
src/lib/            api-client, query-keys, proxy-request, admin-session, site
src/store/          глобальні Zustand-стани (тема, toast)
```

- `page.tsx` і `layout.tsx` лише збирають маршрут. Не імпортуй сторінку в
  іншу сторінку чи компонент — спільний екран винось у `features` (lint це
  забороняє).
- `features/maps/server` — лише серверний код; компоненти, hooks і store його
  не імпортують (lint це забороняє). Серверні змінні (`API_INTERNAL_URL`,
  `WEB_PROXY_SECRET`, `DYNMAP_*`) читай лише в маршрутах і серверних модулях.
- Запити з клієнта йдуть через `lib/api-client` на `/v1/*`; ключі кешу — у
  `lib/query-keys`. Відповіді парси схемами з `@okrip/contracts`.
- Server Components — базовий варіант; `"use client"` став у найменшому
  компоненті, якому потрібні стан, події чи браузерні API.
- Локальний UI-стан (форма, діалог, фільтр) тримай у компоненті; Zustand —
  лише для справді глобального стану. Неактивні списки не опитуй.
- Тексти інтерфейсу українською. Дати показуй у `Europe/Kyiv`; відсутні дані
  — «Немає даних», а не порожнеча чи `Invalid Date`.
- Перевір клавіатуру, підписи полів, видимий фокус, світлу й темну теми та
  вузький екран. Оновлення даних не повинно стирати введений текст.

Тести — Vitest + Testing Library поруч із компонентом (`*.test.tsx`), `@/` —
це `src/`. Команди в `apps/web`: `pnpm test`, `pnpm typecheck`, `pnpm lint`,
`pnpm build`. Лише вебсервер: `pnpm --filter @okrip/web dev`.

Документація:

- Next.js App Router: https://nextjs.org/docs/app
- React: https://react.dev
- Tailwind CSS 3: https://v3.tailwindcss.com/docs
- TanStack Query 5: https://tanstack.com/query/v5/docs/framework/react/overview
- Zustand: https://zustand.docs.pmnd.rs
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Dynmap: https://github.com/webbukkit/dynmap
