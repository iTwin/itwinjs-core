/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
  "plugins": [
    "jam3",
    "jsx-a11y"
  ],
  "extends": [
    "plugin:@itwin/itwinjs-recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "jam3/no-sanitizer-with-danger": 2,
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "function",
        "format": [
          "camelCase",
          "PascalCase"
        ]
      }
    ],
    "@typescript-eslint/unbound-method": "off"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}