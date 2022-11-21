/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
  "plugins": [
    "jam3",
    "jsx-a11y",
    "react-hooks",
    "react"
  ],
  "extends": [
    "plugin:@itwin/itwinjs-recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:react/recommended"
  ],
  "rules": {
    "jam3/no-sanitizer-with-danger": 2,
    "max-statements-per-line": "off", // override itwinjs-recommended
    "nonblock-statement-body-position": "off", // override itwinjs-recommended
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
    "@itwin/react-set-state-usage": ["error", { "updater-only": false, "allow-object": true }],
    "@typescript-eslint/unbound-method": "off",
    "react/prop-types": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
