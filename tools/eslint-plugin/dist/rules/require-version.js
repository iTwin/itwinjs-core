/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");

module.exports = {
  create(context) {

    const parserServices = getParserServices(context);

    function checkJsDoc(declaration, node) {
      let tags = ts.getJSDocTags(declaration);

      if (!tags || tags.length == 0) {
        return;
      }
      for (let tag of tags) {
        if (tag.tagName.escapedText == "deprecated") {

          if (tag.comment == undefined) {
            context.report(node, "Please provide version and info about the depercated API");
          }
          else if (!(/\d+\.(\d|x)/.test(String(tag.comment)))) {
            context.report(node, "@deprecated version not found");
          }
        }
      }
    }

    return {
      ExportNamedDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkJsDoc(tsCall, node);
      }
    }

  }
}
