import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "out/**", "dist/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/**/page", "@/app/**/page.tsx"],
              message:
                "Спільний компонент сторінки має бути у features, а не в іншому маршруті.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/features/**/components/**/*.tsx",
      "src/features/**/hooks/**/*.ts",
      "src/components/**/*.tsx",
      "src/store/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**/page",
                "@/app/**/page.tsx",
                "@/features/maps/server/*",
              ],
              message:
                "Не імпортуйте маршрути або серверні модулі мап у компоненти й клієнтські hooks.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
