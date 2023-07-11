const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.jsdocConfig,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-statements-per-line": "off"
    }
  },
  {
    files: ["src/test/**/*"],
    rules: {
      "deprecation/deprecation": "off"
    }
  }
];