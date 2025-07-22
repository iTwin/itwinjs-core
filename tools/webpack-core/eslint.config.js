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
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-console": "off"
    }
  },
  ...eslintBaseConfig
];