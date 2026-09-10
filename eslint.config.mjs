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
);
