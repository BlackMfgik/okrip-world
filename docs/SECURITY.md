# Безпека

- OAuth state має 256 біт випадковості, TTL 10 хвилин і окремий browser cookie. У БД тільки HMAC state/browser token; state видаляється атомарно до обміну code. URL після входу фіксований.
- Session token випадковий, opaque; у БД лише HMAC. Cookie host-only, HttpOnly, SameSite=Lax, Secure у production, TTL 7 днів. Logout видаляє сесію. Старі state/session видаляються щогодини. Ротація SESSION_SECRET інвалідує всі сесії та незавершені OAuth flow.
- Discord identity upsert по стабільному discord_id; членство перевіряється при вході й кожній заявці. Access token живе тільки під час callback.
- Браузер працює через server-side Next proxy на origin сайту. Точна Origin-перевірка на cookie mutations, точний CORS origin; query string не обходить CSRF. Браузерний payload не може задати discord_id.
- Rate limits: OAuth start 10/min, callback 20/min, заявки 5/min, інтеграції 120/min. Ключ browser IP передається web → API з короткоживучим HMAC під окремим WEB_PROXY_SECRET. Railway X-Real-IP довіряємо лише коли сервіс має RAILWAY_ENVIRONMENT_ID. Для іншого reverse proxy адаптуйте перевірений trust boundary; у development усі локальні користувачі мають одну IP-групу. Сирим X-Forwarded-For не довіряємо. Лічильники локальні для єдиної API-репліки; edge WAF потрібен для мережевих атак.
- Telegram: secret header + allowlist Telegram user IDs + точний закритий chat ID. Текст повідомлень без parse_mode, отже користувацькі імена не інтерпретуються як HTML/Markdown.
- Minecraft: bearer token і server ID; порівняння через SHA-256/timingSafeEqual. Плагін приймає тільки чотири типізовані дії, не виконує shell/RCON/довільні console commands. Редиректи HTTP заборонені. API URL плагіна тільки HTTPS.
- request URL, cookie й authorization не логуються. API повідомляє про 5xx лише з request ID; зовнішні exception не віддаються користувачеві. Не вмикайте debug HTTP logging у проксі, плагіні або SDK. У Railway HTTP logs перевірте політику зберігання OAuth query strings.
- DATABASE_URL, Discord/Telegram tokens і SESSION_SECRET тільки на API. Web отримує тільки API_INTERNAL_URL і WEB_PROXY_SECRET на сервері. Жодного secret із NEXT_PUBLIC_. Minecraft config містить тільки API URL, serverId, окремий server token та інтервали.
- PostgreSQL runtime приватний. Плагін і web не отримують DB credentials. Міграції запускаються окремим pre-deploy кроком.

## Межі гарантій

Whitelist перевіряє право входу для ніка/UUID; він не підтверджує володіння Minecraft-акаунтом. Для offline-mode встановіть AuthMe або інший захист від impersonation перед відкриттям сервера. Для online-mode плагін отримує профіль асинхронно; неіснуючий premium nickname лишиться в retry, доки адміністратор не розв'яже проблему.

Бани нестандартних Minecraft-плагінів без запису в ProfileBanList не можна виявити універсально. Потрібен адаптер до їх API або /wlban. Зберігайте delivery-journal.json між рестартами, обмежте доступ до config.yml. Після повної втрати whitelist-файлу вже completed команди автоматично не відтворюються: відновіть whitelist із backup або проведіть контрольовану повторну синхронізацію з аудитом.

Адмін-панель, unban workflow, зміна закріпленого ніка, Microsoft OAuth і кілька Minecraft-серверів відкладені. Модель підтримує їх подальше додавання; не обходьте інваріанти ручним видаленням користувачів.

## Перевірені джерела інтеграцій

[Discord OAuth](https://docs.discord.com/developers/topics/oauth2), [Discord guild API](https://docs.discord.com/developers/resources/guild), [Telegram Bot API](https://core.telegram.org/bots/api), [Paper project setup](https://docs.papermc.io/paper/dev/project-setup/), [Railway headers](https://docs.railway.com/networking/public-networking/specs-and-limits).
