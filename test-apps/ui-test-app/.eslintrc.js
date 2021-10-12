/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Provide a blank config so that build doesn't fail due to ESLint warnings from react-scripts build step
// The plugins need to be loaded to avoid getting errors from eslint-disable comments
// npm lint script uses an alternative configuration provided in package.json

module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: [
      "tsconfig.json",
      "tsconfig.backend.json"
    ],
    sourceType: "module"
  },
  plugins: [
    "@itwin",
    "@typescript-eslint",
    "react",
    "react-hooks",
    "import",
    "prefer-arrow",
    "deprecation"
  ]
}