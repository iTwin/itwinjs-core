module.exports = {
  plugins: [
    "@itwin",
    "@typescript-eslint",
    "react-hooks",
    "import",
    "prefer-arrow",
    "deprecation",
    "react"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    "project": "tsconfig.json",
    "sourceType": "module"
  },
  rules: {
    "@itwin/public-extension-exports": [
      "error",
      {
        "releaseTags": [
          "public",
          "preview"
        ],
        "outputApiFile": true
      }
    ]
  }
}