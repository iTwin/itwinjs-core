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
        for (let comment of node.comments) {
          if (/@deprecated/.test(comment.value)) {
            if (!(/\d+(\.(\d|x))+.{5,}/.test(comment.value))) {
              context.report(comment, "@deprecated in Major.minor format followed by deprecation reason and/or alternative API usage required");
            }
          }
        }
      }
    }
  }
}
