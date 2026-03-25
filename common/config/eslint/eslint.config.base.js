module.exports = [
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-non-null-assertion": "error"
    }
  },
  {
    files: ["**/test/**/*.ts"],
    rules: {
      "@itwin/no-internal-barrel-imports": "off",
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  },
]
