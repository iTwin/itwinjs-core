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
          warnOn: {
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
    const bannedTags = (context.options.length > 0 && context.options[0].warnOn) || ["alpha", "internal"];
    const parserServices = getParserServices(context);
    const typeChecker = parserServices.program.getTypeChecker();

    function checkJsDoc(declaration, node, name) {
      if (!declaration || !declaration.jsDoc)
        return undefined;

      for (const jsDoc of declaration.jsDoc)
        if (jsDoc.tags)
          for (const tag of jsDoc.tags)
            if (bannedTags.includes(tag.tagName.escapedText)) {
              context.report({
                node,
                messageId: "forbidden",
                data: {
                  name: name || declaration.symbol.escapedName,
                  tag: tag.tagName.escapedText,
                }
              });
            }
    }

    function checkWithParent(declaration, node) {
      if(!declaration)
        return;
      checkJsDoc(declaration, node);
      if (declaration.parent && declaration.parent.kind === ts.SyntaxKind.ClassDeclaration)
        checkJsDoc(declaration.parent, node);
    }

    JSON.stringifyOnce = function (obj, replacer, indent) {
      var printedObjects = [];
      var printedObjectKeys = [];

      function printOnceReplacer(key, value) {
        if (printedObjects.length > 2000) { // browsers will not print more than 20K, I don't see the point to allow 2K.. algorithm will not be fast anyway if we have too many objects
          return 'object too long';
        }
        var printedObjIndex = false;
        printedObjects.forEach(function (obj, index) {
          if (obj === value) {
            printedObjIndex = index;
          }
        });

        if (key == '') { //root element
          printedObjects.push(obj);
          printedObjectKeys.push("root");
          return value;
        }

        else if (printedObjIndex + "" != "false" && typeof (value) == "object") {
          if (printedObjectKeys[printedObjIndex] == "root") {
            return "(pointer to root)";
          } else {
            return "(see " + ((!!value && !!value.constructor) ? value.constructor.name.toLowerCase() : typeof (value)) + " with key " + printedObjectKeys[printedObjIndex] + ")";
          }
        } else {

          var qualifiedKey = key || "(empty key)";
          printedObjects.push(value);
          printedObjectKeys.push(qualifiedKey);
          if (replacer) {
            return replacer(key, value);
          } else {
            return value;
          }
        }
      }
      return JSON.stringify(obj, printOnceReplacer, indent);
    };

    return {
      CallExpression(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        // typeChecker.getTypeAtLocation(a.thisParameter.valueDeclaration).symbol

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

        const resolved = typeChecker.getSymbolAtLocation(tsCall);
        if (!resolved || !resolved.declaration)
          return;
        checkWithParent(resolved.declaration, node);
      },

      Decorator(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getResolvedSignature(tsCall);
        // typeChecker.getResolvedSignature(tsCall).declaration.jsDoc[i].tags[j].tagName
        if (!resolved || !resolved.declaration)
          return;
        checkJsDoc(resolved.declaration, node);
      },

      JSXOpeningElement(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!tsCall)
          return;

        const resolved = typeChecker.getResolvedSignature(tsCall);
        if(!resolved)
        return;
        if (resolved.resolvedReturnType && resolved.resolvedReturnType.symbol)
          checkJsDoc(resolved.resolvedReturnType.symbol.valueDeclaration, node); // class
        if(resolved.declaration)
          checkJsDoc(resolved.declaration, node); // constructor
      },

      TaggedTemplateExpression(node) {
        const tsCall = parserServices.esTreeNodeToTSNodeMap.get(node);
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


// function resolveSignature(node, candidatesOutArray, checkMode) {
//   switch (node.kind) {
//       case 195 /* CallExpression */:
//           return resolveCallExpression(node, candidatesOutArray, checkMode);
//       case 196 /* NewExpression */:
//           return resolveNewExpression(node, candidatesOutArray, checkMode);
//       case 197 /* TaggedTemplateExpression */:
//           return resolveTaggedTemplateExpression(node, candidatesOutArray, checkMode);
//       case 156 /* Decorator */:
//           return resolveDecorator(node, candidatesOutArray, checkMode);
//       case 266 /* JsxOpeningElement */:
//       case 265 /* JsxSelfClosingElement */:
//           return resolveJsxOpeningLikeElement(node, candidatesOutArray, checkMode);
//   }
//   throw ts.Debug.assertNever(node, "Branch in 'resolveSignature' should be unreachable.");
// }