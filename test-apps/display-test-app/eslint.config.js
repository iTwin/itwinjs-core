const iTwinPlugin = require("@itwin/eslint-plugin");

const customLanguageOptions = {
  sourceType: "module",
  parser: require("@typescript-eslint/parser"),
  parserOptions: {
    project: [
      "./tsconfig.json",
      "./tsconfig.backend.json",
      "./tsconfig.buildScripts.json",
      "./vite.config.ts"
    ],
    ecmaVersion: "latest",
    ecmaFeatures: {
      jsx: true,
      modules: true
    },
  },
};

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
    languageOptions: customLanguageOptions
  }
];