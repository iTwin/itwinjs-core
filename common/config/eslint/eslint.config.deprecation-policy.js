const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    languageOptions: {
      sourceType: "module",
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "tsconfig.json",
        ecmaVersion: "latest",
        ecmaFeatures: {
          jsx: true,
          modules: true
        },
      },
    },
    plugins: {
      "@itwin": iTwinPlugin
    },
    files: ["**/*.ts"],
    rules: {
      "@itwin/require-version-in-deprecation": [
        "warn",
        {
          removeOldDates: true,
          addVersion: "5.1.9"
        }
      ]
    }
  }
]