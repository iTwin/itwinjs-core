const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.jsdocConfig,
  },
  {
    files: ["**/*.ts"],
    rules: {
      "max-statements-per-line": "off"
    }
  },
  {
    files: ["src/test/**/*"],
    rules: {
      "@typescript-eslint/no-deprecated": "off"
    }
  },
  ...eslintBaseConfig,
];