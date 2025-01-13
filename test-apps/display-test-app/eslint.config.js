const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

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
  },
  ...eslintBaseConfig,
];