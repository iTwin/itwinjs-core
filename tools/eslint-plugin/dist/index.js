/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const requireDir = require('require-dir');
const rules = requireDir("./rules");
const configs = requireDir("./configs");

module.exports = {
  rules,
  configs
};