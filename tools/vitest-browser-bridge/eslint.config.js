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
    files: ["**/*.{ts,mts}"],
    rules: {
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/unbound-method": "off",
      "no-console": "off",
    },
  },
  ...eslintBaseConfig,
];
