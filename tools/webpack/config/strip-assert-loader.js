/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

module.exports = function loader(source) {
  source = source.replace(/bentleyjs_core_\d+\.assert/g, "/*@__PURE__*/(function(){})");
  return source;
}