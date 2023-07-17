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
      "@itwin/no-internal-barrel-imports": [
        "error",
        {
          "required-barrel-modules": [
            "./src/tile/internal.ts"
          ]
        }
      ],
      "@itwin/public-extension-exports": [
        "error",
        {
          "releaseTags": [
            "public",
            "preview"
          ],
          "outputApiFile": false
        }
      ]
    }
  },
  ...eslintBaseConfig,
];