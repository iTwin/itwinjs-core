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
<<<<<<< HEAD
          addVersion: "5.13.6"
=======
          addVersion: "5.14.0"
>>>>>>> 11e615a8af (Apply deprecation date rule for v5.14.0)
        }
      ]
    }
  }
]