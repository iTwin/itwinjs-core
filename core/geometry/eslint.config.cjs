const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/indent": "off",
      "max-statements-per-line": "off",
      "nonblock-statement-body-position": "off"
    }
  },
  ...eslintBaseConfig,
];