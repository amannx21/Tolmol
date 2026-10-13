import js from "@eslint/js"
import tseslint from "typescript-eslint"
import globals from "globals"

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "test-results/**", "**/*.d.ts", "apps/web/public/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
)
