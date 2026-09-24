# Railway + Kinetic

## 1. Підготовка

Створіть Discord application і bot, додайте bot до потрібного guild. Запишіть client ID/secret, bot token і guild ID у Railway API variables. Зареєструйте точний redirect `https://<web-domain>/v1/auth/discord/callback`. OAuth scope — identify; guild membership отримується серверним bot token. Подачі заявок через Discord-команди немає.

Створіть окремого Telegram-бота, додайте його до закритої групи модераторів із правом надсилати й редагувати власні повідомлення. TELEGRAM_ADMIN_CHAT_ID — ID групи, TELEGRAM_ADMIN_USER_IDS — ID дозволених адміністраторів через кому, без пробілів. Членство у групі саме по собі не дає права модерації.

## 2. Railway services

Створіть три сервіси в одному проєкті/середовищі: Postgres, api, web (наявний сайт може називатися okrip-world). Сайт і API підключаються до одного репозиторію. Repository root для обох build — `/`, корінь monorepo. Для API задайте Dockerfile path `apps/api/Dockerfile` та змінну `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`; для сайту — відповідно `apps/web/Dockerfile`. Поточний Railway API відхиляє Config File Path як застарілий: застосовуйте параметри безпосередньо в налаштуваннях сервісів. Наявні TOML-файли самі по собі не налаштовують ці сервіси. Не встановлюйте root directory на apps/api чи apps/web, інакше не буде shared contracts.

PostgreSQL: приватна мережа, volume, backups. Не створюйте публічний TCP proxy для runtime. API DATABASE_URL посилається на приватну змінну Postgres. Для ручних робіт використовуйте захищений Railway tunnel і вимикайте його після роботи.

API variables — усі API-поля з .env.example, з production значеннями:

- NODE_ENV=production; PORT=3001.
- APP_BASE_URL і WEB_ORIGIN — однакова HTTPS адреса сайту без кінцевого слеша.
- DISCORD_REDIRECT_URI — адреса web callback вище.
- SESSION_SECRET, WEB_PROXY_SECRET, TELEGRAM_WEBHOOK_SECRET, MINECRAFT_SERVER_TOKEN — різні криптографічно випадкові значення, не коротші 32 символів. Telegram secret тільки A–Z/a–z/0–9/_/-.
- Discord/Telegram IDs і tokens; MINECRAFT_SERVER_ID=vanilla.
- `APPLICATION_AUTO_APPROVE=false` залишає ручну Telegram-модерацію. `true` одразу схвалює нову заявку, створює active access і `whitelist_add`; це поточний перемикач режиму, окремої адмін-панелі немає.

Web variables: NODE_ENV=production, PORT=3000, API_INTERNAL_URL=`http://api.railway.internal:3001` і той самий WEB_PROXY_SECRET. Використайте фактичне private DNS ім'я вашого API. RAILWAY_ENVIRONMENT_ID надає платформа. Web не отримує DB, Discord або Telegram secrets.

Додайте public domains для web і api (наприклад, world.example.com / api.example.com), застосуйте DNS-записи з Railway й дочекайтеся TLS. API public domain потрібен Telegram і Kinetic; браузер користується web origin. Після зміни web domain оновіть APP_BASE_URL, WEB_ORIGIN і Discord redirect разом.

API pre-deploy: `pnpm --filter @okrip/api db:migrate`. Міграції не запускаються під час build. Deployment healthcheck — /ready; для web — /health, timeout 60 секунд. API одна репліка, без sleeping/serverless: внутрішній Telegram worker повинен доставляти збережені jobs. У налаштуваннях сервісів задайте restart policy ON_FAILURE, максимум 10 повторів. Після зміни параметрів збірки запускайте нову збірку з source; повтор старого deployment може використати попередню конфігурацію.

## 3. Telegram webhook

Після успішного /ready зареєструйте webhook через Bot API setWebhook. Виконуйте з захищеного shell, не вставляйте реальний token у репозиторій або історію загальних скриптів. Приклад PowerShell, що читає секрети з environment:

```powershell
$webhookBody = @{
  url = 'https://<api-domain>/v1/integrations/telegram/webhook'
  secret_token = $env:TELEGRAM_WEBHOOK_SECRET
  allowed_updates = @('message', 'callback_query')
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri ('https://api.telegram.org/bot' + $env:TELEGRAM_BOT_TOKEN + '/setWebhook') -ContentType 'application/json' -Body $webhookBody
```

Перевірте getWebhookInfo: URL правильний, pending_update_count не росте, немає last_error_message. Не запускайте getUpdates/polling поряд із webhook.

## 4. Kinetic Hosting

1. Ціль цієї збірки — Paper/Purpur 1.21.11, Java 21. Для інших версій API спочатку перебудуйте й перевірте сумісність. Folia не підтримується.
2. Зберіть `apps/minecraft-plugin` через Gradle wrapper; завантажте `build/libs/OkripWhitelist-1.4.0.jar` у /plugins (старий 1.3.0 JAR видаліть). Спочатку задеплойте сервіс api: меню `/wlmenu` потребує оновленого snapshot.
3. Запустіть один раз, щоб створити plugins/OkripWhitelist/config.yml. При placeholder token плагін відключиться до налаштування.
4. Укажіть HTTPS public API URL, server-id, той самий MINECRAFT_SERVER_TOKEN і timeout 8 секунд. Переконайтеся, що public domain/proxy API пропускає WebSocket upgrade, і перезапустіть сервер.
5. У server.properties встановіть white-list=true. Для offline-mode встановіть і налаштуйте AuthMe/аналог; користувачі мають вводити нік із первісним регістром.
6. Збережіть plugins/OkripWhitelist/delivery-journal.json у backup, не видаляйте його при оновленні JAR. Запускайте один екземпляр плагіна на serverId.

Стандартні profile-бани синхронізуються через подію kick та перевірку списку кожні 10 секунд. Для явного бану зареєстрованого гравця: `/wlban <nickname> <reason>` (старий аліас `/okripban` теж працює), permission okrip.admin (op за замовчуванням). Команда ставить подію в чергу; дочекайтеся зміни доступу та виконання ban. Бани сторонніх систем потребують адаптера. Щоб прибрати гравця з вайтліста без бану: `/wldel <nickname>`. Це те саме, що «Видалити» в адмін-панелі сайту: доступ скасовується і гравець зникає з whitelist сервера. Гравця, який зараз на сервері, команда не кікає. Unban не робіть повторним OAuth: окремий адміністративний workflow відкладено.

## 4a. Мапа Dynmap

Сайт показує Dynmap на `/map-vanilla` через проксі `/dynmap/*` (Railway → Kinetic). Напряму вбудувати мапу не можна: сайт працює по HTTPS, а вебсервер Dynmap — по HTTP, браузер блокує такий iframe. Проксі також вмикає `sandbox` для контенту мапи, щоб скрипти з Minecraft-сервера не мали доступу до сесій сайту.

**Kinetic**

1. Встановіть Dynmap (Modrinth/SpigotMC) у /plugins. Перевірте в changelog, що збірка підтримує вашу версію Paper.
2. У панелі Kinetic відкрийте вкладку мережі (Network) та додайте ще один порт (allocation). Якщо панель не дає цього зробити, попросіть підтримку. Цей порт буде портом вебсервера Dynmap. Якщо для старого BlueMap уже було виділено порт, використайте його.
3. Запустіть сервер один раз, зупиніть його та відредагуйте `plugins/dynmap/configuration.txt`:

   ```yaml
   webserver-enabled: true
   webserver-bindaddress: 0.0.0.0
   webserver-port: <виділений порт>
   # Сайт лише показує мапу: вимикаємо чат і логін із вебу
   allowwebchat: false
   login-enabled: false
   # Економія CPU хостингу та трафіку Railway
   deftemplatesuffix: lowres
   image-format: jpg-q75
   tiles-rendered-at-once: 1
   ```

   У `worlds.txt` за потреби вимкніть незатребувані світи (`enabled: false` для world_nether/world_the_end).
4. Запустіть сервер. Перевірте мапу напряму: `http://<ip або хост Kinetic>:<порт>/` має відкрити Dynmap.
5. Запустіть початковий рендер у консолі: `dynmap fullrender world` (краще тоді, коли мало гравців, бо він важкий). Стан рендеру показує `dynmap stats`.

**Railway**

6. У сервісі **web** додайте змінну `DYNMAP_ORIGIN=http://<ip або хост Kinetic>:<порт>` без шляху й без завершального слеша, і перезапустіть сервіс.
7. Відкрийте `https://<сайт>/dynmap/up/configuration`. Має повернутися JSON. Після цього `/map-vanilla` показує мапу. Якщо Dynmap не відповідає, сторінка покаже «МАПА НАРАЗІ НЕДОСТУПНА».

Вигляд: проксі підключає до сторінки Dynmap скін сайту (`apps/web/public/dynmap-skin.css` і `dynmap-skin.js`). Компас, годинник, бічна панель і кнопка посилання приховані; зум, координати й перемикач «Мапа / 3D / Печери» оформлені в стилі сайту і підлаштовуються під його світлу чи темну тему. Після змін у цих файлах збільште `SKIN_VERSION` у `apps/web/src/app/dynmap/[...path]/route.ts`, щоб браузери не тримали стару версію.

Трафік: кожен тайл мапи проходить через Railway і тарифікується як вихідний трафік web-сервісу. Тайли кешуються в браузері, а `jpg-q75`/`lowres` зменшують обсяг, але все одно поставте spend limit у Railway.

## 5. Обов'язковий smoke test перед відкриттям

1. /health і /ready повертають 200. Web відкриває старі сторінки, /application, Discord login.
2. Discord учасник входить, неучасник не отримує сесію. При ручній модерації створення заявки дає pending; при авто-схваленні — approved/active і одразу з'являється у whitelist snapshot. Перевірте неправильний нік і регістронезалежний дубль.
3. Повідомлення приходить у закриту Telegram-групу. Неавторизований адміністратор не може змінити стан.
4. Схваліть заявку; повторіть callback — у БД одна whitelist_add. Плагін має отримати WebSocket-сигнал без очікування інтервалу. Спочатку сайт показує syncing, після plugin complete — доступ відкрито. Перевірте реальний вхід Minecraft.
5. Тимчасово відключіть API від Minecraft; схваліть другу заявку; відновіть мережу — команда виконується. Перезапустіть плагін між виконанням і ack — журнал відновлює доставку.
6. Натисніть «Відхилити», введіть причину через Telegram ForceReply і переконайтеся, що повідомлення та сайт показують саме цю причину. Бан забороняє повторну заявку навіть після виходу й нового Discord OAuth.

Автоматичні API-тести мокають Discord/Telegram, Java-тести перевіряють журнал. Вони не доводять роботу TLS, сторонніх bot permissions, Kinetic scheduler або входу реального клієнта. Виконайте ці кроки з вашими обліковими даними.

## Експлуатація

Увімкніть PostgreSQL backups, перевірте restore на окремій БД, налаштуйте Railway spend alerts/limits за власним бюджетом. Налаштуйте зовнішній uptime monitor /ready і сповіщення за повторюваними Request failed / Telegram delivery deferred / Synchronization deferred. Налаштування платних сервісів і бюджету не застосовуються автоматично.

Перевіряйте в приватній БД старі pending/failed minecraft_commands і незавершені telegram_jobs. Backoff до 5 хвилин; постійна помилка потребує оператора. Після зміни секретів оновлюйте обидві сторони інтеграції. Не видаляйте outbox або користувачів для ремонту доступу; зберігайте історію й audit.

Джерела: [Railway config](https://docs.railway.com/config-as-code/reference), [pre-deploy](https://docs.railway.com/deployments/pre-deploy-command), [healthcheck](https://docs.railway.com/deployments/healthchecks), [Paper setup](https://docs.papermc.io/paper/dev/project-setup/), [Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook).

## Тимчасове отримання Telegram ID

TELEGRAM_ADMIN_CHAT_ID і TELEGRAM_ADMIN_USER_IDS можна пропустити або залишити порожніми. API запускається, але модерація й доставка заявок призупинені зі збереженням черги. Після реєстрації webhook із message та callback_query надішліть /ids@username_бота у групі від кожного майбутнього модератора: бот покаже ID чату й автора. Внесіть перевірені числові ID у Railway (користувачі через кому). Після перезапуску доставка відновиться, а команда отримання ID вимкнеться. Discord ID та токени залишаються обов'язковими.

