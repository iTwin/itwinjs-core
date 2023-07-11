const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
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