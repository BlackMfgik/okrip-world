# Правила плагіна OkripWhitelist

Paper/Purpur 1.21, Java 21, Gradle. Не входить у pnpm workspace і Turborepo.
Користувацька документація й команди — у `README.md` цієї папки.

```text
src/main/java/world/okrip/whitelist/
  OkripWhitelistPlugin.java  вхід плагіна
  api/                       HTTP-клієнт Okrip API
  commands/                  опитування, виконання й підтвердження черги команд,
                             журнал доставки
  config/ listeners/ menu/   конфіг, події, GUI-меню
src/test/java/               JUnit-тести
```

- Плагін виконує лише типізовані дії з API; жодних shell, RCON чи довільних
  console-команд. HTTP-редиректи заборонені, `api-url` — лише HTTPS.
- Доставка команд — at-least-once з журналом `delivery-journal.json`;
  виконання має бути ідемпотентним, підтвердження — після успішної дії.
- Не логуй `server-token` і повні заголовки запитів.
- Схема відповідей API — у `packages/contracts/src/minecraft.ts`; зміни
  формату узгоджуй з API так, щоб стара версія JAR не ламалась.
- Тексти для гравців і адміністраторів — українською; час — `Europe/Kyiv`.
- При зміні поведінки онови `README.md` і `version` у `build.gradle.kts`.

Збірка й тести: `bash gradlew build` (на Windows — `gradlew.bat build`).
Результат — `build/libs/OkripWhitelist.jar`. Встановлення на сервер робить
користувач.

Документація:

- Розробка плагінів Paper: https://docs.papermc.io/paper/dev/
- Javadoc Paper API: https://jd.papermc.io/paper/
- Gradle: https://docs.gradle.org/current/userguide/userguide.html
