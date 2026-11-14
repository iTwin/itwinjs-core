const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

module.exports = [
  {
    files: ["**/*.{ts,mts}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
    languageOptions: {
      ...iTwinPlugin.configs.iTwinjsRecommendedConfig.languageOptions,
      parserOptions: {
        ...iTwinPlugin.configs.iTwinjsRecommendedConfig.languageOptions?.parserOptions,
        project: "tsconfig.eslint.json",
      },
    },
  },
  {
    // The provider and its Electron session report process and window failures on the console.
    files: ["src/electron/provider.ts", "src/electron/provider-session.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // The session loads consumers' CommonJS backend initialization modules with require().
    files: ["src/electron/provider-session.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  ...eslintBaseConfig,
];
