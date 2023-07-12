const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "radix": "warn",
      "@typescript-eslint/explicit-member-accessibility": "warn"
    }
  }
];