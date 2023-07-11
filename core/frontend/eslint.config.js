const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.{ts,tsx}"],
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
  {
    files: [
      "*.test.ts",
      "*.test.tsx",
      "**/test/**/*.ts"],
    rules: {
      "@itwin/no-internal-barrel-imports": "off"
    }
  }
];