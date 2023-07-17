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