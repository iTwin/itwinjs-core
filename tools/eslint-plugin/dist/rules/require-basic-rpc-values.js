/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Based on TSLint rule: ../tslint-rules/requireBasicRpcValuesRule.ts

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const ts = require("typescript");
const { getParserServices } = require("./utils/parser");

const LOCKED = Symbol("LOCKED");

/**
 * This rule ensures only basic values are used in RPC interfaces.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Ensures only basic values are used in RPC interfaces.",
      category: "TypeScript",
    }
  },


  create(context) {
    const parserServices = getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    function isRpcInterface(node) {
      if (node.superClass
        && (node.superClass.type === "Identifier" && node.superClass.name === "RpcInterface"
          || node.superClass.type === "ClassExpression" && node.superClass.id && node.superClass.id.name === "RpcInterface"))
        return true;

      return false;
    }

    function isStatic(tsNode) {
      if (tsNode.modifiers) {
        for (const modifier of tsNode.modifiers) {
          if (modifier.kind === ts.SyntaxKind.StaticKeyword) {
            return true;
          }
        }
      }

      return false;
    }

    function resolveReferences(type) {
      let currentType = type;
      let base = currentType.symbol ? currentType.symbol.getName() : "";

      for (; ;) {
        if (currentType.typeArguments && currentType.typeArguments.length && (base === "Array" || base === "Promise")) {
          currentType = currentType.typeArguments[0];
          base = currentType.symbol ? currentType.symbol.getName() : "";
        } else {
          const bases = currentType.getBaseTypes();
          if (bases && bases.length === 1 && bases[0].symbol && bases[0].symbol.name === "Array") {
            if (bases[0].typeArguments && bases[0].typeArguments.length) {
              currentType = bases[0].typeArguments[0];
              base = currentType.symbol ? currentType.symbol.getName() : "";
              continue;
            }
          }

          break;
        }
      }

      return { type: currentType, base };
    }

    function isPrimitive(type) {
      const F = ts.TypeFlags;
      return (type.getFlags() & (F.String | F.StringLiteral | F.Number | F.NumberLiteral | F.Boolean | F.BooleanLiteral | F.Null | F.Undefined | F.Enum | F.EnumLiteral)) !== 0;
    }

    function isPropsUnion(type, node) {
      let primitives = 0;
      let classes = 0;

      for (const member of type.types) {
        const resolvedMember = resolveReferences(member).type;
        if (resolvedMember.isClass()) {
          ++classes;
        } else if (isUndefinedOrNull(resolvedMember)) {
          // these don't count as a primitive in this case
        } else if (checkNode(node, resolvedMember, "")) {
          ++primitives;
        }
      }

      return classes === 1 && primitives;
    }

    function isUndefinedOrNull(type) {
      const F = ts.TypeFlags;
      return (type.getFlags() & (F.Undefined | F.Null)) !== 0;
    }

    function isFunction(symbol) {
      const F = ts.SymbolFlags;
      return (symbol.getFlags() & (F.Function | F.Method | F.Constructor)) !== 0;
    }

    function checkNode(tsNode, type, scope) {
      const { type: resolvedType, base } = resolveReferences(type);

      if (resolvedType[LOCKED]) {
        return true;
      }

      resolvedType[LOCKED] = true;

      let failure = false;
      let childFailure = false;
      let message = "Unsupported RPC value.";

      if (resolvedType.isClass()) {
        failure = true;
        message += `\n"${scope ? (scope + ".") : ""}${resolvedType.symbol.getName()}" is a class.`;
      } else if (!isPrimitive(resolvedType)) {

        if (resolvedType.objectFlags && resolvedType.objectFlags === ts.ObjectFlags.Reference) {
          if (resolvedType.typeArguments) {
            let t = 0;
            for (const member of resolvedType.typeArguments) {
              if (!checkNode(tsNode, member, `${scope || base}.[${t}]`)) {
                childFailure = true;
              }
              ++t;
            }
          }
        } else if (resolvedType.isUnionOrIntersection()) {
          if (tsNode && isPropsUnion(resolvedType, tsNode)) {
            // special case
          } else {
            let t = 0;
            for (const member of resolvedType.types) {
              if (!checkNode(tsNode, member, `${scope}.[${t}]`)) {
                childFailure = true;
              }
              ++t;
            }
          }
        } else if (base === "Uint8Array") {
          // special case
        } else {
          const properties = resolvedType.getProperties();

          for (const member of properties) {
            if (isFunction(member)) {
              failure = true;
              message += `\n"${scope || base}.${member.name}" is a function.`;
            } else if (tsNode) {
              const memberType = checker.getTypeOfSymbolAtLocation(member, tsNode);

              if (!checkNode(tsNode, memberType, `${scope || base}.${member.name}`)) {
                childFailure = true;
              }
            }
          }
        }
      }

      if (failure && tsNode) {
        context.report({
          node: parserServices.tsNodeToESTreeNodeMap.get(tsNode),
          message,
        })
      }

      resolvedType[LOCKED] = false;

      return !failure && !childFailure;
    }

    function isRpcReturn(tsNode) {
      let node = tsNode;
      for (; ;) {
        if (node.kind === ts.SyntaxKind.MethodDeclaration && isStatic(node)) {
          return false;
        }

        if (node.parent.kind === ts.SyntaxKind.ClassDeclaration) {
          return isRpcInterface(node.parent);
        } else if (node.parent.kind === ts.SyntaxKind.SourceFile) {
          return false;
        } else {
          node = node.parent;
        }
      }
    }

    return {
      ClassDeclaration(node) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

        if (isRpcInterface(node)) {
          tsNode.forEachChild((child) => {
            if (child.kind !== ts.SyntaxKind.MethodDeclaration || isStatic(child))
              return;

            const method = child;

            // checkParameters(method);
            for (const param of method.parameters) {
              if (!param.type)
                continue;
              const type = checker.getTypeFromTypeNode(param.type);
              checkNode(param, type, "");
            }

            // checkReturnType(method);
            const signature = checker.getSignatureFromDeclaration(method);
            if (signature) {
              checkNode(signature.getDeclaration().type, signature.getReturnType(), "");
            }
          });
        }
      },

      CallExpression(node) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

        const signature = checker.getResolvedSignature(tsNode);
        if (signature) {
          const declaration = signature.getDeclaration();
          if (!declaration || !declaration.parent) {
            return;
          }

          if (ts.isClassDeclaration(declaration.parent) && isRpcInterface(declaration.parent)) {
            for (const argument of node.arguments) {
              const type = checker.getTypeAtLocation(argument);
              checkNode(argument, type, "");
            }
          }
        }
      },

      ReturnStatement(node) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!isRpcReturn(tsNode))
          return;

        for (const child of tsNode.getChildren()) {
          const type = checker.getTypeAtLocation(child);
          checkNode(child, type, "");
        }
      }
    };
  }
}
