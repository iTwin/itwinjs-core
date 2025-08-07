const iTwinPlugin = require("@itwin/eslint-plugin");
const prettierConfig = require("eslint-config-prettier");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

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
      "@typescript-eslint/no-non-null-assertion": "off"
    },
  },
  ...eslintBaseConfig
];
