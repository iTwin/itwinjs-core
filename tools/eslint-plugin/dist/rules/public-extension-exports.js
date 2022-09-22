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
      namespace: `Namespace "{{name}}" is without an @extensions tag but one of its members has one.`,
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

    // reports an error if namespace doesn't have a valid @extensions tag but a member does
    function checkNamespaceTags(declaration, node) {
      const tags = ts.getJSDocTags(declaration.parent);
      if (!tags || tags.length === 0)
        return;

      for (const tag of tags) {
        if (tag.tagName.escapedText === extensionsTag) {
          return;
        }
      }
      context.report({
        node,
        messageId: "namespace",
        data: {
          name: ts.getNameOfDeclaration(declaration.parent)?.getFullText(),
        }
      });
    }

    // returns true if it was added to the API without error
    function checkJsDoc(declaration, node) {
      if (!declaration || !declaration.jsDoc)
        return;

      const tags = ts.getJSDocTags(declaration);
      if (!tags || tags.length === 0)
        return;

      let jsDocExtensionTag = tags.find(tag => tag?.tagName?.escapedText === extensionsTag);
      let jsDocPreviewTag = tags.find(tag => tag?.tagName?.escapedText === previewTag);
      // Has extension API tag
      if (jsDocExtensionTag) {
        addToApiList(declaration, jsDocPreviewTag);
        const validReleaseTag = tags.some(tag => releaseTags.includes(tag?.tagName?.escapedText));
        if (validReleaseTag) {
          return true;
        } else {
          let name;
          if (declaration.kind === ts.SyntaxKind.Constructor)
            name = declaration.parent?.symbol?.escapedName;
          else {
            name = declaration.symbol?.escapedName;
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

    function isNamespace(declaration) {
      return ts.isModuleBlock(declaration) && ts.isModuleDeclaration(declaration.parent);
    }

    function check(declaration, node) {
      if (!declaration)
        return;
      if (checkJsDoc(declaration, node)) {
        if (declaration.parent && isNamespace(declaration.parent))
          checkNamespaceTags(declaration.parent, node);
      }
    }

    return {
      TSNamespaceExportDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },

      TSExportAssignment(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },

      TSExportKeyword(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },

      ExportDefaultDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },

      ExportNamedDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },

      ExportAllDeclaration(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },

      ExportSpecifier(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;
        check(tsCall, node);
      },
    };
  }
}