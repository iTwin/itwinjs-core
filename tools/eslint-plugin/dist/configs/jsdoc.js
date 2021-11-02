/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
  "extends": [
    "plugin:jsdoc/recommended"
  ],
  "plugins": [
    "jsdoc"
  ],
  "settings": {
    "jsdoc": {
      "mode": "typescript",
      "ignoreInternal": true,
      "exemptedBy": ["alpha"]
    }
  },
  "rules": {
    "jsdoc/newline-after-description": "off",
    "jsdoc/check-alignment": "off",
    "jsdoc/check-tag-names": "off",
    "jsdoc/empty-tags": "off",
    "jsdoc/multiline-blocks": "off",
    "jsdoc/no-multi-asterisks": "off",
    "jsdoc/require-param": "off",
    "jsdoc/require-param-type": "off",
    "jsdoc/require-returns": "off",
    "jsdoc/require-returns-type": "off",
    "jsdoc/require-jsdoc": [
      "error",
      {
        "publicOnly": true, // only report exports
        "require": {
          "ArrowFunctionExpression": true,
          "ClassDeclaration": true,
          "ClassExpression": true,
          "FunctionDeclaration": true,
          "FunctionExpression": true,
          "MethodDefinition": false,
        },
        "contexts": [
          "TSEnumDeclaration",
          "TSInterfaceDeclaration",
          "TSTypeAliasDeclaration",
        ]
      }
    ],
    "jsdoc/require-yields": "off",
    "jsdoc/tag-lines": "off",
  }
}