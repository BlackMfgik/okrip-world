# Okrip Cosmetics — крила ангела

3D-моделі крил для HMCCosmetics (Paper/Purpur 1.21.11), зроблені з піксель-арт референсів у `tools/refs/`.

| Косметика | Модель | Превʼю |
|---|---|---|
| `angel_wings` — розкриті | `okrip:angel_wings`, 96 елементів, текстура 128×32 | `previews/angel_wings.png` |
| `angel_wings_folded` — складені | `okrip:angel_wings_folded`, 74 елементи, текстура 64×64 | `previews/angel_wings_folded.png` |

Кожне крило — екструдований піксель-арт (як ванільні предмети, товщина 0,5 px), розбитий на сегменти, які загинаються назад на 0° / 22,5° / 45°, тож крила огортають спину, а не стирчать пласкою площиною.

## Встановлення

1. Зберіть ресурс-пак: `cd resourcepack && zip -r ../dist/okrip-cosmetics.zip .` (або додайте теку `assets/okrip` у ваш наявний серверний пак).
2. Скопіюйте `hmccosmetics/cosmetics/okrip_wings.yml` у `plugins/HMCCosmetics/cosmetics/`.
3. Додайте косметики в меню HMCCosmetics (`menus/*.yml`) і видайте права `hmccosmetics.cosmetic.angel_wings` / `hmccosmetics.cosmetic.angel_wings_folded`.
4. `/cosmetic reload` (або перезапуск).

Предмет посилається на модель через `model-id` → компонент `item_model` (1.21.4+), тож ванільний `paper.json` не перевизначається і конфліктів з іншими паками немає.

## Підгонка положення на спині

Положення задає блок `display.head` у `resourcepack/assets/okrip/models/item/cosmetics/*.json` (зараз `translation [0, -8, 4]`, `scale 1.6` / `1.25`). Якщо крила сидять зависоко або далеко від спини, відкрийте модель у Blockbench (File → Open Model), вкладка Display → Head, підкрутіть і збережіть — або змініть значення в `tools/generate_wings.py` і перегенеруйте.

## Blender

`blender/angel_wings.glb` і `blender/angel_wings_folded.glb` — ті самі моделі з вшитою текстурою: File → Import → glTF 2.0. 1 блок = 1 м, +Z — спина гравця. Змінена в Blender модель у гру сама не потрапить: Minecraft читає лише JSON-модель, тож правки треба переносити через Blockbench або `tools/generate_wings.py`.

## Перегенерація

Потрібні Python 3, Pillow, numpy.

```
python3 tools/generate_wings.py          # текстури, моделі, items/*.json
python3 tools/render_preview.py angel_wings
python3 tools/render_preview.py angel_wings_folded
python3 tools/export_glb.py angel_wings           # blender/*.glb
python3 tools/export_glb.py angel_wings_folded
```

Параметри (роздільність сітки, кути згину, масштаб, зазор між крилами) — у словнику `VARIANTS` на початку `generate_wings.py`.
