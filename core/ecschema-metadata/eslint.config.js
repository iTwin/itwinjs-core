const iTwinPlugin = require("@itwin/eslint-plugin");

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
  {
    files: [
      "*.test.ts",
      "**/test/**/*.ts"
    ],
    rules: {
      "@itwin/no-internal-barrel-imports": "off"
    }
  }
];