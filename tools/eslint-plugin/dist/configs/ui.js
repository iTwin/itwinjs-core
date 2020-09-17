/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
  "plugins": [
    "jsx-a11y"
  ],
  "extends": [
    "plugin:@bentley/imodeljs-recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "@typescript-eslint/naming-convention": [
      "warn",
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