/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");

/**
 * This rule prevents the use of APIs with specific release tags.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent the use of APIs with specific release tags.",
      category: "TypeScript",
    },
    messages: {
      forbidden: `"{{name}}" is {{tag}}.`,
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          tag: {
            type: "array",
            uniqueItems: true,
            items: {
              type: "string",
              enum: ["public", "beta", "alpha", "internal"]
            }
          }
        }
      }
    ]
  },

  create(context) {
    const bannedTags = (context.options.length > 0 && context.options[0].tag) || ["alpha", "internal"];
    const parserServices = getParserServices(context);
    const typeChecker = parserServices.program.getTypeChecker();

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

    function checkJsDoc(declaration, node, name) {
      if (!declaration || !declaration.jsDoc)
        return undefined;

      for (const jsDoc of declaration.jsDoc)
        if (jsDoc.tags)
          for (const tag of jsDoc.tags)
            if (bannedTags.includes(tag.tagName.escapedText) && !isLocalFile(declaration)) {
              let dataName = "";
              const parentSymbol = getParentSymbolName(declaration);
              if (parentSymbol)
                dataName += parentSymbol + ".";
              dataName += name || declaration.symbol.escapedName;
              context.report({
                node,
                messageId: "forbidden",
                data: {
                  name: dataName,
                  tag: tag.tagName.escapedText,
                }
              });
            }
    }

    function checkWithParent(declaration, node) {
      if(!declaration)
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
      CallExpression(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getResolvedSignature(tsCall);
        if (!resolved || !resolved.declaration)
          return;
        checkWithParent(resolved.declaration, node);

        const resolvedSymbol = typeChecker.getSymbolAtLocation(tsCall.expression);
        if(resolvedSymbol)
          checkWithParent(resolvedSymbol.valueDeclaration, node);
      },

      NewExpression(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolvedClass = typeChecker.getTypeAtLocation(tsCall);
        if (resolvedClass && resolvedClass.symbol)
          checkJsDoc(resolvedClass.symbol.valueDeclaration, node);

        const resolvedConstructor = typeChecker.getResolvedSignature(tsCall);
        if (resolvedConstructor)
          checkJsDoc(resolvedConstructor.declaration, node, `${resolvedClass.symbol.escapedName} constructor`);
      },

      MemberExpression(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getSymbolAtLocation(tsCall);
        if (!resolved || !resolved.valueDeclaration)
          return;
        checkWithParent(resolved.valueDeclaration, node);
      },

      Decorator(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getResolvedSignature(tsCall);
        if (!resolved || !resolved.declaration)
          return;
        checkJsDoc(resolved.declaration, node);
      },

      JSXOpeningElement(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getResolvedSignature(tsCall);
        if (!resolved)
          return;
        if (resolved.resolvedReturnType && resolved.resolvedReturnType.symbol)
          checkJsDoc(resolved.resolvedReturnType.symbol.valueDeclaration, node); // class
        if(resolved.declaration)
          checkJsDoc(resolved.declaration, node); // constructor
      },

      TaggedTemplateExpression(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getResolvedSignature(tsCall);
        if (resolved)
          checkJsDoc(resolved.declaration, node);
      },

      TSTypeReference(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getTypeAtLocation(tsCall);
        if (resolved)
          checkJsDoc(resolved.declaration, node);
      },
    };
  }
}