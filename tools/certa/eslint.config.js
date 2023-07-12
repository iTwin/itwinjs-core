const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-console": "off"
    }
  }
];