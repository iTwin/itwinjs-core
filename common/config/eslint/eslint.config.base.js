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
      "@typescript-eslint/no-unsafe-enum-comparison": "off"
    }
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/unbound-method": "warn"
    }
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off"
    }
  },
]
