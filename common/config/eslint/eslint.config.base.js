module.exports = [
  {
    files: ["**/test/**/*.ts"],
    rules: {
      "@itwin/no-internal-barrel-imports": "off"
    }
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@itwin/require-version-in-deprecation": [
        "error",
        {
          removeOldDates: true,
          addVersion: "5.1.0"
        }
      ]
    }
  }
]