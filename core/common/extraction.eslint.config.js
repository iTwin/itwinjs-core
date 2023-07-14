const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["src/**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.ts"],
    ...iTwinPlugin.configs.extensionExportsConfig,
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "@itwin/no-internal-barrel-imports": "off",
      "@typescript-eslint/unbound-method": "off",
      "comma-dangle": "off"
    }
  }
];