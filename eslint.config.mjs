import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", ".git/**"],
  },
  {
    // Global rule overrides
    rules: {
      "no-empty": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ], // Unused imports/vars as warnings
    },
  },
  {
    // ----------------------------------------------------
    // React Packages (e.g., packages/cli with OpenTUI)
    // ----------------------------------------------------
    files: ["packages/cli/**/*.ts", "packages/cli/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "warn",

      "react-hooks/exhaustive-deps": "warn", // Enforces hook dependency arrays!
    },
  },
  {
    // ----------------------------------------------------
    // Backend Packages (e.g., packages/server, packages/shared)
    // ----------------------------------------------------
    files: [
      "packages/server/**/*.ts",
      "packages/shared/**/*.ts",
      "packages/db/**/*.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Backend specific rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
