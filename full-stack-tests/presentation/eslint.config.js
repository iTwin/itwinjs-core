const iTwinPlugin = require("@itwin/eslint-plugin");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...prettierConfig.rules,
      curly: ["error", "all"],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "deprecation/deprecation": "warn",
    },
  },
];
