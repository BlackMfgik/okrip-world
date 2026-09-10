# API v1

Усі JSON-тіла валідуються Zod; невідомі поля заявки та Minecraft-команд відхиляються. Ліміт тіла 16 KiB. Відповіді браузера не містять внутрішніх UUID, Telegram ID, access token або DB-рядків. JSON-помилки: `{ code, message }`, без stack trace. Персональні відповіді мають Cache-Control: no-store.

## Браузер: через origin сайту

| Метод і маршрут | Вхід | Результат |
| --- | --- | --- |
| GET /v1/auth/discord/start | — | 302 у Discord, browser-bound OAuth cookie |
| GET /v1/auth/discord/callback | code, state | 302 на /application; при помилці на /auth/callback?error=login_failed |
| GET /v1/me | session cookie | `{user:null}` або `{user:{username,displayName}}` |
| POST /v1/auth/logout | session cookie, точний Origin | 204, сесію видалено |
| POST /v1/applications | session cookie, Origin, `{minecraftUsername}` | 201, поточний стан |
| GET /v1/applications/current | session cookie | 200, поточний стан; 401 без сесії |

Поточний стан:

`{application: null | {publicId, minecraftUsername, status, rejectionReason}, access: null | "active" | "revoked" | "banned", synchronization: null | "waiting" | "completed"}`.

application.status: pending / approved / rejected / cancelled. Відсутність заявки — 200 із application:null. Synchronization completed означає підтверджену плагіном whitelist_add, а не лише схвалення. Бан або revoked має вищий пріоритет у UI.

## Telegram: публічна адреса API

POST /v1/integrations/telegram/webhook. Заголовок X-Telegram-Bot-Api-Secret-Token, callback_query.from.id з allowlist і правильний chat.id обов'язкові. Callback data: `approve:<publicId>` / `reject:<publicId>`; publicId — 16 випадкових URL-safe символів. Повторне рішення — 200 без повторного створення доступу/команд. Рішення зберігається до косметичного answerCallbackQuery; редагування повідомлення доставляється через DB-job.

## Minecraft: публічна адреса API

Для всіх маршрутів: `Authorization: Bearer <server token>`, `X-Server-Id: vanilla` (або налаштований ID).

| Маршрут POST | Тіло | Відповідь |
| --- | --- | --- |
| /v1/minecraft/commands/lease | `{limit:1}` | `{commands:[{id,leaseToken,type,payload}]}` |
| /v1/minecraft/commands/:id/complete | `{leaseToken}` | 204 |
| /v1/minecraft/commands/:id/fail | `{leaseToken,error:"execution_failed"}` або local_ban | 204 |
| /v1/minecraft/events/ban | `{eventId,username,reason}` | 204; повторний eventId — no-op |

Lease приймає limit від 1 до 10, але MVP повертає максимум одну команду за запит. Строк оренди — 60 секунд. Прострочений/чужий leaseToken — 409; чужий server token — 401; невідомий command ID — 404. Повторний complete для того самого завершеного leaseToken — 204. Fail повертає команду до повторної доставки із затримкою до 5 хвилин.

Типи: whitelist_add / whitelist_remove / kick / ban. Payload: `{username,reason?}`; нік 3–16 символів, reason до 256. reason не може бути довільною серверною консольною командою. Ban event для невідомого ніка — 404; він не резервує довільні ніки в БД.

## Health

API /health — процес живий; /ready — PostgreSQL відповідає. Web /health — процес сайту відповідає. Health не підтверджує доступність Discord, Telegram чи Minecraft; повний smoke test описано окремо.
