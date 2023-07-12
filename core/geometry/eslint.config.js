const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/indent": "off",
      "max-statements-per-line": "off",
      "nonblock-statement-body-position": "off"
    }
  }
];