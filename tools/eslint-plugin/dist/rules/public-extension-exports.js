/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");
const fs = require("fs");

/** converts the numeric typescript enum value for ts.SyntaxKind to a string. Defaults to "real". */
const getSyntaxKindFriendlyName = (syntaxKind) => {
  const syntaxKindFriendlyNames = {
    [ts.SyntaxKind.ClassDeclaration]: "real",
    [ts.SyntaxKind.EnumDeclaration]: "enum",
    [ts.SyntaxKind.InterfaceDeclaration]: "interface",
    [ts.SyntaxKind.TypeAliasDeclaration]: "type",
  }
  return syntaxKindFriendlyNames[syntaxKind] || "real";
}


let firstRun = true;

/**
 * This rule prevents the exporting of extension APIs that not not meet certain release tags.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent the exporting of extension APIs that do not meet certain release tags.",
      category: "TypeScript",
    },
    messages: {
      forbidden: `{{kind}} "{{name}}" without one of the release tags "{{releaseTags}}".`,
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          releaseTags: {
            type: "array",
            uniqueItems: true,
            items: {
              type: "string",
              enum: ["public", "beta", "alpha", "internal", "preview"]
            }
          },
          outputApiFile: {
            type: "boolean"
          }
        }
      }
    ]
  },

  create(context) {
    const parserServices = getParserServices(context);

    const releaseTags = (context.options.length > 0 && context.options[0].releaseTags) || ["public"];
    const extensionsTag = "extensions";
    const previewTag = "preview";

    const outputApiFile = (context.options.length > 0 && context.options[0].outputApiFile) || false;
    const apiFilePath = "./lib/GeneratedExtensionApi.csv";

    if (firstRun) {
      firstRun = false;
      if (outputApiFile) {
        // create/clear output api file on first run
        fs.writeFileSync(apiFilePath, "");
      }
    }

    function addToApiList(declaration, isPreview) {
      if (!outputApiFile) {
        return;
      }

      const createCsvString = (name, kind) => `${name},${kind},${isPreview ? 'preview' : 'public'}\n`;

      const names = declaration.kind === ts.SyntaxKind.VariableStatement ?
        declaration.declarationList.declarations.map(d => d.symbol.escapedName) :
        [declaration.symbol.escapedName];
      names.forEach(name => {
        const kind = getSyntaxKindFriendlyName(declaration.kind);
        const csvString = createCsvString(name, kind);
        fs.writeFileSync(apiFilePath, csvString, { flag: "a" });
      });
    }

    function getParentSymbolName(declaration) {
      if (declaration.parent && declaration.parent.symbol && !declaration.parent.symbol.escapedName.startsWith('"'))
        return declaration.parent.symbol.escapedName;
      return undefined;
    }

    function checkJsDoc(declaration, node) {
      // Only check local elements, not consumed ones
      if (!declaration || !declaration.jsDoc)
        return undefined;

      for (const jsDoc of declaration.jsDoc)
        if (jsDoc.tags) {
          let jsDocExtensionTag = jsDoc.tags.find(tag => tag.tagName.escapedText === extensionsTag);
          let jsDocPreviewTag = jsDoc.tags.find(tag => tag.tagName.escapedText === previewTag);
          // Has extension API tag
          if (jsDocExtensionTag) {
            addToApiList(declaration, jsDocPreviewTag);
            // Does not have any of the required release tags
            if (!jsDoc.tags.some(tag => releaseTags.includes(tag.tagName.escapedText))) {
              let name;
              if (declaration.kind === ts.SyntaxKind.Constructor)
                name = declaration.parent.symbol.escapedName;
              else {
                name = declaration.symbol.escapedName;
                const parentSymbol = getParentSymbolName(declaration);
                if (parentSymbol)
                  name = `${parentSymbol}.${name}`;
              }

              context.report({
                node,
                messageId: "forbidden",
                data: {
                  kind: getSyntaxKindFriendlyName(declaration.kind),
                  name,
                  releaseTags: releaseTags,
                }
              });
            }
          }
        }
    }

    function checkWithParent(declaration, node) {
      if (!declaration)
        return;
      checkJsDoc(declaration, node);
      if (declaration.parent && [
        ts.SyntaxKind.ClassDeclaration,
        ts.SyntaxKind.EnumDeclaration,
        ts.SyntaxKind.InterfaceDeclaration,
        ts.SyntaxKind.ModuleDeclaration,
      ].includes(declaration.parent.kind))
        checkJsDoc(declaration.parent, node);
    }

    return {
      TSNamespaceExportDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSExportAssignment(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      TSExportKeyword(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      ExportDefaultDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      ExportNamedDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      ExportAllDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },

      ExportSpecifier(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        checkWithParent(tsCall, node);
      },
    };
  }
}