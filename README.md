# Okrip World

🌐 **Live:** [okrip.world](https://okrip.world)

Website and player verification system for a Ukrainian Minecraft network (3 servers), built for a client.
Players sign in with Discord, submit an application with their Minecraft nickname, moderators review it in Telegram,
and approved players are automatically whitelisted on the game server.

**Stack:** Next.js · Fastify · PostgreSQL · Drizzle · Zod · Turborepo · Java 21 (Paper plugin) · Vitest · Docker · GitHub Actions

- Turborepo monorepo: Next.js web app, Fastify API with a background worker, shared Zod contracts
- Java plugin with retry-based command delivery, so approved players are never lost between services
- Live Dynmap world maps through a server-side proxy
- CI: typecheck, lint, Vitest tests on real PostgreSQL, build
