const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error"
    }
  },
  {
    files: ["**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  }
];