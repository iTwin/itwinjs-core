const iTwinPlugin = require("@itwin/eslint-plugin");

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
  }
];