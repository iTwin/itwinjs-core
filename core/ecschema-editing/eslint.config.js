const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "radix": "warn",
      "@typescript-eslint/explicit-member-accessibility": "warn"
    }
  }
];