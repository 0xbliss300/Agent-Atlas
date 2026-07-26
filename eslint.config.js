import js from "@eslint/js";
import react from "eslint-plugin-react";

const browserGlobals = {
  Blob: "readonly",
  URL: "readonly",
  document: "readonly",
  HTMLElement: "readonly",
  navigator: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "artifacts/**", ".npm-cache/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: browserGlobals,
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["src/**/*.jsx"],
    plugins: {
      react,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/jsx-uses-vars": "error",
    },
  },
  {
    files: ["scripts/**/*.mjs", "vite.config.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        URL: "readonly",
        process: "readonly",
      },
    },
  },
];
