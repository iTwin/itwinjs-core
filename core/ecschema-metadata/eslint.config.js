const iTwinPlugin = require("@itwin/eslint-plugin");
const eslintBaseConfig = require("../../common/config/eslint/eslint.config.base");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.ts"],
    rules: {
      "radix": "warn",
      "@typescript-eslint/explicit-member-accessibility": "warn",
      "@itwin/no-internal-barrel-imports": [
        "error",
        {
          "ignored-barrel-modules": [
            "./src/ECObjects.ts"
          ]
        }
      ]
    }
  },
  ...eslintBaseConfig,
];