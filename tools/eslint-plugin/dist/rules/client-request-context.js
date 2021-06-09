/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict";

const { getParserServices } = require("./utils/parser");
const { AST_NODE_TYPES } = require("@typescript-eslint/experimental-utils");
const TSESTreeModule = require("@typescript-eslint/typescript-estree");
const { TSESTree } = require("@typescript-eslint/typescript-estree");

const OPTION_DONT_PROPAGATE = "dont-propagate-request-context";
const OPTION_CONTEXT_ARG_NAME = "context-arg-name";

const asyncFuncMoniker = "promise-returning function";

/** @typedef {import("@typescript-eslint/typescript-estree")} TSESTreeModule */
/** @typedef {TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration} FuncDeclLike */

/** Get the final element of an Array
 * @template T
 * @param {T[]} array
 * @returns {T | undefined}
 */
function back(array) {
  return array[array.length - 1];
}

/**
 * Find an element in the array, and return the element after it
 * handles undefined arrays by returning undefined
 * @template T
 * @param {T[] | undefined} array
 * @param {Parameters<Array<T>["findIndex"]>[0]} predicate
 * @returns {T | undefined}
 */
function findAfter(array, predicate) {
  if (array === undefined)
    return undefined;
  const index = array.findIndex(predicate);
  return array[index + 1];
}

class ASTPreconditionViolated extends Error {}

/**
 * Given a syntax construct that has a statement child, replace
 * that statement child with a block
 * @param { TSESTree.ForOfStatement
 *        | TSESTree.ArrowFunctionExpression
 *        | TSESTree.IfStatement
 *        | TSESTree.ForOfStatement
 *        | TSESTree.ForInStatement
 *        | TSESTree.ForStatement
 *        } stmt
 * @param {import("@typescript-eslint/experimental-utils/dist/ts-eslint").RuleFixer} fixer
 * @param {{textBefore?: string}}  options
 * @returns {void}
 */
// XXX: make sure reqCtx is not placed inside if statements incorrectly
function promoteBlocklessStmtFixer(stmt, fixer, {textBefore} = {textBefore: ""}) {
  const body
    = stmt.type === "IfStatement"
    ? stmt.consequent
    : stmt.body;
  fixer.insertTextBefore(body, "{" + textBefore)
  fixer.insertTextAfter(body, "}")
}

/**
 * Return the statement immediately following the input statement
 // TODO: expand to all input nodes types, not just statements
 * @param {TSESTree.Statement} stmt
 * @returns {TSESTree.Statement | undefined} Statement
 */
function nextStatement(stmt) {
  if (stmt.parent === undefined)
    throw new ASTPreconditionViolated("no parent");
  switch (stmt.parent.type) {
    // XXX: don't these only show up when the statement isn't embedded in the block statement but in the parameter initializers or something?
    case "ArrowFunctionExpression":
      if (stmt.parent.body.type === "BlockStatement")
        return findAfter(stmt.parent.body.body, s => s === stmt);
      // XXX: promote block-less ARROW FUNC EXPR to block
      // XXX: handle empty body
      else return;
    case "FunctionDeclaration":
    case "FunctionExpression":
      return findAfter(stmt.parent.body.body, s => s === stmt);
    case "CatchClause":
      return findAfter(stmt.parent.body.body, s => s === stmt);
    case "TryStatement":
      return findAfter(stmt.parent.block.body, s => s === stmt);
    case "BlockStatement":
      return findAfter(stmt.parent.body, s => s === stmt);
    case "IfStatement":
      // XXX: promote block-less IF-CONSEQUENCE to block
      // XXX: handle empty body
      if (stmt.parent.consequent.type === "BlockStatement")
        return stmt.parent.consequent.body[0];
      else return;
    case "ForInStatement":
    case "ForStatement":
    case "ForOfStatement":
      // XXX: promote block-less FOR BODY to blocks
      // XXX: handle empty body
      if (stmt.parent.body.type === "BlockStatement")
        return stmt.parent.body.body[0];
      else return;
    default:
      throw Error(`Unhandled case: ${stmt.parent.type}`);
  }
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
    const parserServices = getParserServices(context);
    const checker = parserServices.program.getTypeChecker();
    const extraOpts = context.options[0];
    const dontPropagate = extraOpts && extraOpts[OPTION_DONT_PROPAGATE] || false;
    const contextArgName = extraOpts && extraOpts[OPTION_CONTEXT_ARG_NAME] || "clientRequestContext";

    /**
     * @param {TSESTree.Node} node
     * @returns {FuncDeclLike}
     */
    function getOuterFunction(node) {
      /** @type {TSESTree.Node | undefined} */
      let cur = node;
      while (cur && !(cur.type === "FunctionExpression" || cur.type === "ArrowFunctionExpression" || cur.type === "FunctionDeclaration"))
        cur = cur.parent;
      return cur;
    }

    /**
     * @param {TSESTree.Expression} node
     * @returns {TSESTree.Statement | undefined}
     */
    function getExpressionOuterStatement(node) {
      /** @type {TSESTree.Node | undefined} */
      let cur = node;
      while (cur && !/Statement$/.test(cur.type))
        cur = cur.parent;
      return cur;
    }

    /**
    * @param {FuncDeclLike} node
    * @returns {boolean}
    */
    function returnsPromise(node) {
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return false;
      const signature = checker.getSignatureFromDeclaration(tsNode);
      if (!signature) return false;
      const returnType = signature && signature.getReturnType();
      if (!returnType) return false;
      return returnType.symbol && checker.getFullyQualifiedName(returnType.symbol) === "Promise";
    }

    /**
    * @param {TSESTree.Statement} node
    * @param {string} reqCtxArgName
    * @return {boolean}
    */
    function isClientRequestContextEnter(node, reqCtxArgName) {
      if (!node)
        return false;
      // until JSDoc supports `as const`, using explicit strings is easier
      // see: https://github.com/microsoft/TypeScript/issues/30445
      return (
        node &&
        node.type === AST_NODE_TYPES.ExpressionStatement &&
        node.expression.type === AST_NODE_TYPES.CallExpression &&
        node.expression.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.expression.callee.object.type === AST_NODE_TYPES.Identifier &&
        node.expression.callee.object.name === reqCtxArgName &&
        node.expression.callee.property.type === AST_NODE_TYPES.Identifier &&
        node.expression.callee.property.name === "enter"
      );
    }

    /**
     * @type {{
     *  func: FuncDeclLike,
     *  awaits: Set<TSESTree.AwaitExpression>,
     *  reqCtxArgName: string
     * }[]}
     */
    const asyncFuncStack = [];

    /**
     * @param {FuncDeclLike} node
     */
    function VisitFuncDeclLike(node) {
      if (!returnsPromise(node))
        return;

      /** @type {TSESTreeModule.TSESTreeToTSNode<TSESTree.FunctionExpression>} */
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

      const clientReqCtx = node.params.find((p) => {
        const actualParam = p.type === AST_NODE_TYPES.TSParameterProperty ? p.parameter : p;
        const tsParam = parserServices.esTreeNodeToTSNodeMap.get(actualParam);
        const type = checker.getTypeAtLocation(tsParam);
        // TODO: should probably check the package name here too
        return type.symbol && /ClientRequestContext$/.test(checker.getFullyQualifiedName(type.symbol));
      });

      if (clientReqCtx === undefined) {
        context.report({
          node,
          messageId: "noContextParam",
          suggest: [
            {
              desc: "Add a ClientRequestContext parameter",
              fix(fixer) {
                const hasOtherParams = node.params.length > 0;
                return fixer.insertTextBeforeRange(
                  [tsNode.parameters.pos, tsNode.parameters.end],
                  `${contextArgName}: ClientRequestContext${hasOtherParams ? ", " : ""}`
                );
              }
            }
          ]
        });
        return;
      }

      const reqCtxArgName = clientReqCtx.name;

      asyncFuncStack.push({
        func: node,
        awaits: new Set(),
        reqCtxArgName,
      });

      if (node.body.type === "BlockStatement") {
        const firstStmt = node.body.body[0];
        if (!isClientRequestContextEnter(firstStmt, reqCtxArgName))
        context.report({
          node: firstStmt || node.body,
          messageId: "noReenterOnFirstLine",
          suggest: [{
              desc: `Add '${reqCtxArgName}.enter()' as the first statement of the body`,
              fix(fixer) {
                if (firstStmt)
                  return fixer.insertTextBefore(firstStmt, `${reqCtxArgName}.enter();`);
                else if (tsNode.body)
                  return fixer.insertTextBeforeRange(
                    // TODO: clarify why the tsNode locations are like this
                    [tsNode.body.end-1, tsNode.body.end],
                    `${reqCtxArgName}.enter();`
                  );
                return null;
              }
          }],
          data: { reqCtxArgName }
        });
      }
    }

    /** @param {TSESTree.FunctionExpression} node */
    function ExitFuncDeclLike(node) {
      const lastFunc = back(asyncFuncStack);
      if (!lastFunc || lastFunc.func !== node)
        return;
      asyncFuncStack.pop();
      for (const await_ of lastFunc.awaits) {
        const stmt = getExpressionOuterStatement(await_);
        if (stmt === undefined)
          throw Error("unexpected AST format, await expression was not inside a statement");
        // TODO: test + handle cases for expression bodies of arrow functions
        if (stmt.parent === undefined)
          throw Error("unexpected AST format, stmt had no parent node");
        const nextStmt =  nextStatement(stmt);
        if (nextStmt && !isClientRequestContextEnter(nextStmt, lastFunc.reqCtxArgName)) {
          context.report({
            node: nextStmt,
            messageId: "noReenterOnAwaitResume",
            suggest: [
              {
                desc: `Add a call to '${lastFunc.reqCtxArgName}.enter()' after the statement containing 'await'`,
                fix(fixer) {
                  return fixer.insertTextAfter(stmt, `${lastFunc.reqCtxArgName}.enter();`);
                }
              }
            ],
            data: {
              reqCtxArgName: lastFunc.reqCtxArgName
            }
          });
        }
      }
    };

    return {
      /** @param {TSESTree.AwaitExpression} node */
      AwaitExpression(node) {
        const lastFunc = back(asyncFuncStack);
        // if the stack is empty, this is a top-level await and we can ignore it
        if (lastFunc) lastFunc.awaits.add(node);
      },

      /** @param {TSESTree.CatchClause} node */
      CatchClause(node) {
        const outerFunc = getOuterFunction(node);
        const lastFunc = back(asyncFuncStack);
        if (lastFunc === undefined || lastFunc.func !== outerFunc)
          return;

        // TODO: abstract firstStmt check and fixer to reused function
        const firstStmt = node.body.body[0];
        if (!isClientRequestContextEnter(firstStmt, lastFunc.reqCtxArgName))
          context.report({
            node: firstStmt || node.body,
            messageId: "noReenterOnCatchResume",
            suggest: [{
                desc: `Add a call to '${lastFunc.reqCtxArgName}.enter()' as the first statement of the body`,
                fix(fixer) {
                  const bodyIsEmpty = firstStmt === undefined;
                  if (bodyIsEmpty) {
                    const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
                    return fixer.insertTextBeforeRange(
                      // TODO: clarify why the tsNode locations are like this
                      [tsNode.block.end-1, tsNode.block.end],
                      `${lastFunc.reqCtxArgName}.enter();`
                    );
                  }
                  return fixer.insertTextBefore(firstStmt, `${lastFunc.reqCtxArgName}.enter();`);
                }
            }],
            data: {
              reqCtxArgName: lastFunc.reqCtxArgName
            }
          });
      },

      CallExpression(node) {
        // TODO: need to check we aren't in a non-promise returning function nested in an async function...
        // get the outer function and compare to the top of the stack
        const outerFunc = getOuterFunction(node);
        const lastFunc = back(asyncFuncStack);
        if (lastFunc === undefined || lastFunc.func !== outerFunc)
          return;
        // TODO: use type checking to check for thenable's methods
        const isThen = (node.callee.name || node.callee.property.name || node.callee.property.value) === "then";
        const isCatch = (node.callee.name || node.callee.property.name || node.callee.property.value) === "catch";
        const isPromiseCallback = isThen || isCatch;
        if (isPromiseCallback) {
          const callback = node.arguments[0];
          if (callback.type === "FunctionExpression" || callback.type === "ArrowFunctionExpression") {
            // FIXME: deal with non-block body in async funcs...
            if (callback.body.type === "BlockStatement") {
              const firstStmt = callback.body.body[0];
              if (!isClientRequestContextEnter(firstStmt, lastFunc.reqCtxArgName))
              context.report({
                node: firstStmt || callback.body,
                messageId: isThen ? "noReenterOnThenResume" : "noReenterOnCatchResume",
                suggest: [{
                    desc: `Add a call to '${lastFunc.reqCtxArgName}.enter()' as the first statement of the body`,
                    fix(fixer) {
                      const bodyIsEmpty = firstStmt === undefined;
                      if (bodyIsEmpty) {
                        /** @type {TSESTreeModule.TSESTreeToTSNode<TSESTree.CallExpression>} */
                        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
                        return fixer.insertTextBeforeRange(
                          // TODO: abstract out inserting into empty bodies
                          // TODO: clarify why the tsNode locations are like this
                          [tsNode.getEnd()-1, tsNode.getEnd()],
                          `${lastFunc.reqCtxArgName}.enter();`
                        );
                      }
                      return fixer.insertTextBefore(firstStmt, `${lastFunc.reqCtxArgName}.enter();`);
                    }
                }],
                data: {
                  reqCtxArgName: lastFunc.reqCtxArgName
                }
              });
            }
          }
        }
      },


      "ArrowFunctionExpression:exit": ExitFuncDeclLike,
      "FunctionDeclaration:exit": ExitFuncDeclLike,
      "FunctionExpression:exit": ExitFuncDeclLike,
      ArrowFunctionExpression: VisitFuncDeclLike,
      FunctionDeclaration: VisitFuncDeclLike,
      FunctionExpression: VisitFuncDeclLike,
    };
  },
};

module.exports = rule;
