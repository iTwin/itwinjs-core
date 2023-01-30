/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

//Custom rule that enforces version and description for @deprecated

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
            context.report(node, "@deprecated version and description missing");
          }
          else if (!(/\d+(\.(\d|x))+.{5,}/.test(String(tag.comment)))) {
            context.report(node, "@deprecated missing version or description.");
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
