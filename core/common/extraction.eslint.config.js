const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["src/**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  }
];