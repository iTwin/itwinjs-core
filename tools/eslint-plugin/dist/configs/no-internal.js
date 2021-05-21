/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
module.exports = {
  "plugins": [ "@bentley" ],
  "extends": "plugin:@bentley/imodeljs-recommended",
  "rules": {
    "@bentley/no-internal": [ "error", { "tag": [ "internal", "alpha", "beta" ]}]
  }
}