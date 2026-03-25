const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  ...eslintBaseConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
