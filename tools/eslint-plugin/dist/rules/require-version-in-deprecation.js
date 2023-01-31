/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

//Custom rule that enforces version and description for @deprecated

"use strict";

module.exports = {
  create(context) {
    return {
      Program(node) {
        let match;
        for (const comment of node.comments) {
          if (match = /@deprecated(?<in> in \d+(\.(\d|x))+.{5,})?/.exec(comment.value)) {
            if (!match?.groups?.in) {
              context.report(comment, "@deprecated in Major.minor format followed by deprecation reason and/or alternative API usage required");
            }
          }
        }
      }
    }
  }
}
