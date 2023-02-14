/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

//Custom rule that enforces version and description for @deprecated

"use strict";

module.exports = {
  meta: {
    messages: {
      requireVersionAndSentence: "@deprecated in Major.minor format followed by deprecation reason and/or alternative API usage required"
    }
  },
  create(context) {
    return {
      Program(node) {
        let match;
        for (const comment of node.comments) {
          if (match = /@deprecated(?<in> in \d+\.(\d|x)+[.,\s](?<sentence>.+))?/.exec(comment.value)) {
            if ((match?.groups?.in) && (match?.groups?.sentence && match?.groups?.sentence.replace(/\s/g, '').length > 5)) {
              continue;
            }
            else {
              context.report({ node: comment, messageId: "requireVersionAndSentence" });
            }
          }
        }
      }
    }
  }
}
