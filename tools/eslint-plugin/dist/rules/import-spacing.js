/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Adapted from https://github.com/palantir/tslint/blob/master/src/rules/importSpacingRule.ts

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const ts = require("typescript");
const { getParserServices } = require("./utils/parser");

const Rules = {
  ADD_SPACE_AFTER_IMPORT: "AddSpaceAfterImport",
  TOO_MANY_SPACES_AFTER_IMPORT: "TooManySpacesAfterImport",
  ADD_SPACE_AFTER_STAR: "AddSpaceAfterStar",
  TOO_MANY_SPACES_AFTER_STAR: "TooManySpacesAfterStar",
  ADD_SPACE_AFTER_FROM: "AddSpaceAfterFrom",
  TOO_MANY_SPACES_AFTER_FROM: "TooManySpacesAfterFrom",
  ADD_SPACE_BEFORE_FROM: "AddSpaceBeforeFrom",
  TOO_MANY_SPACES_BEFORE_FROM: "TooManySpacesBeforeFrom",
  NO_LINE_BREAKS: "NoLineBreaks",
}

const OPTION_ALLOW_LINE_BREAKS_INSIDE_BRACKETS = "allow-line-breaks-inside-brackets";
const OPTION_ALLOW_LINE_BREAKS = "allow-line-breaks";

/**
 * This rule ensures proper spacing between import statement keywords.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Ensures proper spacing between import statement keywords.",
      category: "TypeScript",
      schema: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            [OPTION_ALLOW_LINE_BREAKS_INSIDE_BRACKETS]: {
              type: "boolean"
            },
            [OPTION_ALLOW_LINE_BREAKS]: {
              type: "boolean"
            },
          }
        }
      ]
    },
    messages: {
      [Rules.ADD_SPACE_AFTER_IMPORT]: "Add space after 'import'",
      [Rules.TOO_MANY_SPACES_AFTER_IMPORT]: "Too many spaces after 'import'",
      [Rules.ADD_SPACE_AFTER_STAR]: "Add space after '*'",
      [Rules.TOO_MANY_SPACES_AFTER_STAR]: "Too many spaces after '*'",
      [Rules.ADD_SPACE_AFTER_FROM]: "Add space after 'from'",
      [Rules.TOO_MANY_SPACES_AFTER_FROM]: "Too many spaces after 'from'",
      [Rules.ADD_SPACE_BEFORE_FROM]: "Add space before 'from'",
      [Rules.TOO_MANY_SPACES_BEFORE_FROM]: "Too many spaces before 'from'",
      [Rules.NO_LINE_BREAKS]: "Line breaks are not allowed in import declaration",
    }
  },


  create(context) {
    const parserServices = getParserServices(context);
    const allowLineBreaksInside = context.options[0][OPTION_ALLOW_LINE_BREAKS_INSIDE_BRACKETS];
    const allowLineBreaks = context.options[0][OPTION_ALLOW_LINE_BREAKS];

    function isNamespaceImport(tsNode) {
      return tsNode.kind === ts.SyntaxKind.NamespaceImport;
    }

    function checkModuleWithSideEffect(tsNode) {
      const nodeStart = tsNode.getStart();
      const moduleSpecifierStart = tsNode.moduleSpecifier.getStart();

      if (nodeStart + "import".length + 1 < moduleSpecifierStart)
        context.report({ node, messageId: Rules.TOO_MANY_SPACES_AFTER_IMPORT });
      else if (nodeStart + "import".length === moduleSpecifierStart)
        context.report({ node, messageId: Rules.ADD_SPACE_AFTER_IMPORT });

      if (!allowLineBreaks && tsNode.getText().indexOf("\n") !== -1)
        context.report({ node, messageId: Rules.NO_LINE_BREAKS });
    }

    function checkImportClause(node, tsNode, importClause) {
      const nodeText = tsNode.getText();
      const nodeStart = tsNode.getStart();
      const importKeywordEnd = nodeStart + "import".length;
      const moduleSpecifierStart = tsNode.moduleSpecifier.getStart();
      const importClauseEnd = importClause.getEnd();
      const importClauseStart = importClause.getStart();

      if (importKeywordEnd === importClauseStart) {
        context.report({ node, messageId: Rules.ADD_SPACE_AFTER_IMPORT });
      } else if (importClauseStart > importKeywordEnd + 1) {
        context.report({ node, messageId: Rules.TOO_MANY_SPACES_AFTER_IMPORT });
      }

      const fromString = nodeText.substring(importClauseEnd - nodeStart, moduleSpecifierStart - nodeStart);
      const fromIndex = fromString.indexOf("from");

      if (fromIndex === 0)
        context.report({ node, messageId: Rules.ADD_SPACE_BEFORE_FROM });
      else if (fromIndex > 1)
        context.report({ node, messageId: Rules.TOO_MANY_SPACES_BEFORE_FROM });

      const spacesAfterFrom = fromString.length - "from".length - fromIndex;
      if (spacesAfterFrom > 1)
        context.report({ node, messageId: Rules.TOO_MANY_SPACES_AFTER_FROM });
      else if (spacesAfterFrom === 0)
        context.report({ node, messageId: Rules.ADD_SPACE_BEFORE_FROM });

      const beforeImportClause = nodeText.substring(0, importClauseStart - nodeStart);
      const importClauseText = nodeText.substring(importClauseStart - nodeStart, importClauseEnd - nodeStart);
      const afterImportClause = nodeText.substring(importClauseEnd - nodeStart);

      if (!allowLineBreaks && (beforeImportClause.indexOf("\n") !== -1 || afterImportClause.indexOf("\n") !== -1))
        context.report({ node, messageId: Rules.NO_LINE_BREAKS });
      if (!allowLineBreaksInside && importClauseText.indexOf("\n") !== -1)
        context.report({ node, messageId: Rules.NO_LINE_BREAKS });
    }

    function checkNamespaceImport(node, tsNode) {
      const nodeText = tsNode.getText();
      if (nodeText.indexOf("*as") !== -1)
        context.report({ node, messageId: Rules.ADD_SPACE_AFTER_STAR });
      else if (/\*\s{2,}as/.test(nodeText))
        context.report({ node, messageId: Rules.TOO_MANY_SPACES_AFTER_STAR });
      else if (!allowLineBreaks && nodeText.indexOf("\n") !== -1)
        context.report({ node, messageId: Rules.NO_LINE_BREAKS });
    }

    return {
      ImportDeclaration(node) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (tsNode.importClause === undefined) {
          checkModuleWithSideEffect(tsNode);
        } else {
          checkImportClause(node, tsNode, tsNode.importClause);
          const namedBindings = tsNode.importClause.namedBindings;
          if (namedBindings !== undefined && isNamespaceImport(namedBindings))
            checkNamespaceImport(node, namedBindings);
        }
      },
    };
  }
}
