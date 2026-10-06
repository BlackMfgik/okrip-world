import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "apps/web/**",
      "**/.next/**",
      "**/build/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["apps/api/src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../**/*.repository.js", "../**/*.service.js"],
              message:
                "Імпортуйте публічний index.js модуля замість його внутрішніх файлів.",
            },
          ],
        },
      ],
    },
  },
);
