/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");
const fs = require("fs");

const syntaxKindFriendlyNames = {
  [ts.SyntaxKind.ClassDeclaration]: "class",
  [ts.SyntaxKind.EnumDeclaration]: "enum",
  [ts.SyntaxKind.InterfaceDeclaration]: "interface",
  [ts.SyntaxKind.ModuleDeclaration]: "module",
  [ts.SyntaxKind.MethodDeclaration]: "method",
  [ts.SyntaxKind.MethodSignature]: "method",
  [ts.SyntaxKind.FunctionDeclaration]: "function",
  [ts.SyntaxKind.PropertyDeclaration]: "property",
  [ts.SyntaxKind.PropertySignature]: "property",
  [ts.SyntaxKind.Constructor]: "constructor",
  [ts.SyntaxKind.EnumMember]: "enum member",
  [ts.SyntaxKind.TypeAliasDeclaration]: "type alias",
  [ts.SyntaxKind.ExportDeclaration]: "export",
  [ts.SyntaxKind.NamespaceExportDeclaration]: "namespace export",
  [ts.SyntaxKind.VariableStatement]: "variable statement"
}

var firstRun = true;

/**
 * This rule prevents the exporting of extension APIs that not not meet certain release tags.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent the exporting of extension APIs that not meet certain release tags.",
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
              enum: ["public", "beta", "alpha", "internal"]
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
    const extensionApiTag = "extensionApi"; // SWB temporary extension tag name

    const outputApiFile = (context.options.length > 0 && context.options[0].outputApiFile) || false;
    const apiFilePath = "./lib/GeneratedExtensionApi.csv";

    if (firstRun) {
      firstRun = false;
      if (outputApiFile) {
        // create/clear output api file on first run
        fs.writeFileSync(apiFilePath, "");
      }
    }

    function addToApiList(declaration, jsDocExtensionTag) {
      if (!outputApiFile) {
        return;
      }

      // Separate interfaces, items marked as real, enums, and others (treated as types)
      let trailer = ",type\n";
      if (declaration.kind === ts.SyntaxKind.EnumDeclaration) {
        trailer = ",enum\n";
      }
      else if (declaration.kind === ts.SyntaxKind.InterfaceDeclaration) {
        trailer = ",interface\n";
      }
      else if (jsDocExtensionTag.comment && jsDocExtensionTag.comment.toLowerCase().includes("real")) {
        trailer = ",real\n";
      }

      if (declaration.kind === ts.SyntaxKind.VariableStatement) {
        fs.writeFileSync(apiFilePath, declaration.declarationList.declarations[0].symbol.escapedName + trailer, { flag: "a" });
        return;
      }

      fs.writeFileSync(apiFilePath, declaration.symbol.escapedName + trailer, { flag: "a" });
    }

    function getFileName(parent) {
      let currentParent = parent;
      while (currentParent) {
        if (currentParent.fileName !== undefined)
          return currentParent.fileName;
        currentParent = currentParent.parent;
      }
      return undefined;
    }

    function isLocalFile(declaration) {
      if (declaration) {
        const fileName = getFileName(declaration.parent);
        if (fileName && typeof fileName === "string" && !fileName.includes("node_modules"))
          return true;
      }
      return false;
    }

    function getParentSymbolName(declaration) {
      if (declaration.parent && declaration.parent.symbol && !declaration.parent.symbol.escapedName.startsWith('"'))
        return declaration.parent.symbol.escapedName;
      return undefined;
    }

    function checkJsDoc(declaration, node) {
      // Only check local elements, not consumed ones
      if (!declaration || !declaration.jsDoc || !isLocalFile(declaration))
        return undefined;

      for (const jsDoc of declaration.jsDoc)
        if (jsDoc.tags) {
          let jsDocExtensionTag = jsDoc.tags.find(tag => tag.tagName.escapedText === extensionApiTag);
          // Has extension API tag
          if (jsDocExtensionTag) {
            addToApiList(declaration, jsDocExtensionTag);
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
                  kind: syntaxKindFriendlyNames.hasOwnProperty(declaration.kind) ? syntaxKindFriendlyNames[declaration.kind] : "unknown object type " + declaration.kind,
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