/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

const replaceAssert = (match: string) => {
  // Note that we pad w/ additional spaces afterwards to preserve source mapping.
  // Also, safe to assume match is always > 6 chars because we're matching "assert(...);"
  return `void 0;${new Array(match.length - 6).join(" ")}`;
}

module.exports = function loader(this: any, source: string) {
  const isCoreBentleyESM = this.context.endsWith(path.normalize("node_modules/@itwin/core-bentley/lib/esm")) || this.context.endsWith(path.normalize("core/bentley/lib/esm"));
  if ((isCoreBentleyESM && !this.resourcePath.endsWith("Assert.js")) || /import *\{.*[ ,]assert(,| \}).* from "@itwin\/core-bentley";/.test(source))
    return source.replace(/(?<=\s)assert\(.*?\);/g, replaceAssert);

  const isCoreBentleyCJS = this.context.endsWith(path.normalize("node_modules/@itwin/core-bentley/lib/cjs")) || this.context.endsWith(path.normalize("core/bentley/lib/cjs"));
  if (isCoreBentleyCJS)
    return source.replace(/\(0, Assert_\d+\.assert\)\(.*?\);/g, replaceAssert);

  return source.replace(/\(0, core_bentley_\d+\.assert\)\(.*?\);/g, replaceAssert);
};
