/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

module.exports = function loader(source: string) {
  source = source.replace(/core_bentley_\d+\.assert/g, "/*@__PURE__*/(function(){})");
  return source;
};
