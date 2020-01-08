/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

module.exports = function loader(source) {
  source = source.replace(/bentleyjs_core_\d+\.assert/g, "/*@__PURE__*/(function(){})");
  return source;
}