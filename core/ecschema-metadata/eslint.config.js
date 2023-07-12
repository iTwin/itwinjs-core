const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["src/**/*.ts"],
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
    files: ["*.test.ts",
      "*.test.tsx",
      "**/test/**/*.ts",
      "**/test/**/*.tsx"],
    rules: {
      "@itwin/no-internal-barrel-imports": "off"
    }
  }
];