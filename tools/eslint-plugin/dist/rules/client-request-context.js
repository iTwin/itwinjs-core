/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// some parts based on @typescript-eslint/no-misused-promises

"use strict";

const { getParserServices } = require("./utils/parser");

const OPTION_DONT_PROPAGATE = "dont-propagate-request-context";
const OPTION_CONTEXT_ARG_NAME = "context-arg-name";

const asyncFuncMoniker = "promise-returning function";

/** @typedef {import("estree").AwaitExpression} AwaitExpression */
/** @typedef {import("estree").FunctionExpression} FunctionExpression */
/** @typedef {import("estree").FunctionExpression | import("estree").ArrowFunctionExpression | import("estree").FunctionDeclaration} FuncDeclLike */

/** Get the final element of an Array
 * @template T
 * @param {T[]} array
 * @returns {T | undefined}
 */
function back(array) {
  return array[array.length - 1];
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Follow the ClientRequestContext rules " +
        "(see https://www.itwinjs.org/learning/backend/managingclientrequestcontext/)",
      category: "TypeScript",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          [OPTION_DONT_PROPAGATE]: {
            type: "boolean",
            description:
              `normally non-node_module-imported ${asyncFuncMoniker}s are flagged if they do not receive ` +
              `the client request context as an argument, this diables that`,
            default: false,
          },
          [OPTION_CONTEXT_ARG_NAME]: {
            type: "string",
            description:
              `The name to use for adding an ClientRequestContext parameter when fixing. Defaults to 'clientRequestContext'`,
            default: "clientRequestContext",
          }
        },
      },
    ],
    fixable: "code",
    messages: {
      noContextParam: `All ${asyncFuncMoniker}s must take a parameter of type ClientRequestContext`,
      noReenterOnFirstLine: `All ${asyncFuncMoniker}s must call 'enter' on their ClientRequestContext immediately`,
      noReenterOnThenResume: `All ${asyncFuncMoniker}s must call 'enter' on their ClientRequestContext immediately in any 'then' callbacks`,
      // TODO: should probably do it after expressions, not statements but that might be more complicated...
      noReenterOnAwaitResume: `All ${asyncFuncMoniker}s must call 'enter' on their ClientRequestContext immediately after resuming from an awaited statement`,
      noReenterOnCatchResume: `All ${asyncFuncMoniker}s must call '{{reqCtxArgName}}.enter()' immediately after catching an async exception`,
      didntPropagate: `All ${asyncFuncMoniker}s must propagate their async to functions`,
      calledCurrent: `All ${asyncFuncMoniker}s must not call ClientRequestContext.current`,
    },
  },

  create(context) {
    // XXX: at least tests don't seem to believe they have full type info...
    let parserServices;
    try {
      parserServices = getParserServices(context);
    } catch (_) {
      parserServices = context.parserServices;
    }
    const checker = parserServices.program.getTypeChecker();
    const extraOpts = context.options[0];
    const dontPropagate = extraOpts && extraOpts[OPTION_DONT_PROPAGATE];
    const contextArgName = extraOpts && extraOpts[OPTION_CONTEXT_ARG_NAME];

    /**
     * @param {import("estree").Expression} node
     * @returns {import("estree").Statement}
     */
    function getExpressionOuterStatement(node) {
      while (node && !/Statement$/.test(node.type)) node = node.parent;
      return node;
    }

    /**
    * @param {FuncDeclLike} node
    * @returns {boolean}
    */
    function returnsPromise(node) {
      // TODO: use type information to resolve aliases
      // currently won't work on `type IntPromise = Promise<number>`
      // TODO: get typescript-estree typings to work
      return node.async || (node.returnType && node.returnType.typeAnnotation.typeName.name === "Promise");
    }

    /**
    * @param {import("estree").Statement} node
    * @param {string} reqCtxArgName
    * @return {boolean}
    */
    function isClientRequestContextEnter(node, reqCtxArgName) {
      /** @type {import("estree").ExpressionStatement} */
      const simpleEnterCall = {
        type: "ExpressionStatement",
        expression: {
          type: "CallExpression",
          optional: false,
          callee: {
            type: "MemberExpression",
            object: {
              type: "Identifier",
              name: reqCtxArgName,
            },
            property: {
              type: "Identifier",
              name: "enter",
            },
            computed: false,
            optional: false,
          },
          arguments: [],
        },
      };
      // until JSDoc supports `as const`, using explicit strings is easier
      // see: https://github.com/microsoft/TypeScript/issues/30445
      return (
        node.type === "ExpressionStatement" &&
        node.expression.type === "CallExpression" &&
        node.expression.callee.type === "MemberExpression" &&
        node.expression.callee.object.type === "Identifier" &&
        node.expression.callee.object.name === reqCtxArgName &&
        node.expression.callee.property.type === "Identifier" &&
        node.expression.callee.property.name === "enter"
      );
    }

    /**
     * @type {{
     *  func: FuncDeclLike,
     *  awaits: Set<AwaitExpression>,
     *  reqCtxArgName: string
     * }[]}
     */
    const funcStack = [];

    /**
     * @param {FuncDeclLike} node
     */
    function VisitFunctionDecl(node) {
      // XXX: might not cover promise-returning functions as well as checking the return type
      if (!returnsPromise(node))
      return;

      /** @type {import("typescript").FunctionExpression} */
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

      // XXX: won't match for example  my_namespace["ClientRequestContext"]
      const clientReqCtx = node.params.find((p) => {
        const identifier = p.type === "AssignmentPattern" ? p.left : p;
        const tsParam = parserServices.esTreeNodeToTSNodeMap.get(identifier);
        try {
          return /ClientRequestContext$/.test(tsParam.parent.type.getText());
        } catch (_) {
          console.error("unknown parameter ast format");
          return;
        }
      });

      if (clientReqCtx === undefined) {
        context.report({
          node,
          messageId: "noContextParam",
          fix(fixer) {
            // TODO: work when there are no params
            const hasOtherParams = node.params.length > 0;
            return fixer.insertTextBefore(
              node.params[0],
              `${contextArgName}: ClientRequestContext${hasOtherParams ? ", " : ""}`
            );
          }
        });
        return;
      }

      funcStack.push({
        func: node,
        awaits: new Set(),
        reqCtxArgName: clientReqCtx.name,
      });
    }

    return {
      AwaitExpression(node) {
        const lastFunc = back(funcStack);
        // if the stack is empty, this is a top-level await and we can ignore it
        if (lastFunc) lastFunc.awaits.add(node);
      },

      CallExpression(node) {
        // TODO: need to check we aren't in a non-promise returning function nested in an async function...
        // get the outer function and compare to the top of the stack
        const lastFunc = back(funcStack);
        if (lastFunc === undefined)
          return;
        // TODO: need "get name of member expr" or typescript type way to check for calls to e.g. promise["then"]
        const isThen = node.callee.name === "then";
        const isCatch = node.callee.name === "catch";
        const isPromiseCallback = isThen || isCatch;
        if (isPromiseCallback) {
          const callback = node.arguments[0];
          if (callback.type === "FunctionExpression" || callback.type === "ArrowFunctionExpression") {
            if (callback.body.type === "BlockStatement") {
              const firstStmt = callback.body.body[0];
              if (!isClientRequestContextEnter(firstStmt, lastFunc.reqCtxArgName))
              context.report({
                node: firstStmt,
                messageId: isThen ? "noReenterOnThenResume" : "noReenterOnCatchResume",
                data: {
                  reqCtxArgName: lastFunc.reqCtxArgName
                }
              });
            }
          }
        }
      },

      /** @param {import("estree").FunctionExpression} node */
      "FunctionExpression:exit"(node) {
        const lastFunc = back(funcStack);
        if (!lastFunc || lastFunc.func !== node)
          return;
        funcStack.pop();
        for (const await_ of lastFunc.awaits) {
          const stmt = getExpressionOuterStatement(await_);
          const stmtIndex = stmt.parent.body.findIndex((s) => s === stmt);
          const nextStmt = stmt.parent.body[stmtIndex + 1];
          if (nextStmt && !isClientRequestContextEnter(nextStmt, lastFunc.reqCtxArgName)) {
            context.report({
              node: nextStmt,
              messageId: "noReenterOnAwaitResume",
              suggest: [
                {
                  desc: `Add a call to '${lastFunc.reqCtxArgName}.enter()' after the statement containing 'await'`,
                  fix(fixer) {
                    return fixer.insertTextAfter(
                      stmt,
                      `${lastFunc.reqCtxArgName}.enter();`
                    );
                  }
                }
              ],
              data: {
                reqCtxArgName: lastFunc.reqCtxArgName
              }
            });
          }
        }
      },

      FunctionExpression: VisitFunctionDecl,
      FunctionDeclaration: VisitFunctionDecl,
      ArrowFunctionExpression: VisitFunctionDecl,
    };
  },
};

module.exports = rule;
