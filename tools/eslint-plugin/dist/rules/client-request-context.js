/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const ts = require("typescript");
const { getParserServices } = require("./utils/parser");

const OPTION_DONT_PROPAGATE = "dont-propagate-request-context";

const asyncFuncMoniker = "promise returning function";

/** @typedef {import("estree").AwaitExpression} AwaitExpression */
/** @typedef {import("estree").FunctionExpression} FunctionExpression */

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Follow the ClientRequestContext rules "
        + "(see https://www.itwinjs.org/learning/backend/managingclientrequestcontext/)",
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
        },
      },
    ],
    fixable: "code",
    messages: {
      noContextArg: `All ${asyncFuncMoniker}s must take an argument of type ClientRequestContext`,
      noReenterOnFirstLine: `All ${asyncFuncMoniker}s `,
      noReenterOnThenResume: "fail",
      noReenterOnAwaitResume: "fail",
      noReenterOnCatchResume: "fail",
      didntPropagate: `All ${asyncFuncMoniker}s must propagate their async to functions`,
      failureUpdaterOnly:
        'Do not use callback parameter in setState. Use componentDidUpdate method instead ("updater-only" switch).',
      failureAccessedMember:
        "Do not access 'this.{{accessedMember}}' in setState. Use arguments from callback function instead.",
    },
  },

  create(context) {
    const parserServices = getParserServices(context);
    const dontPropagate = context.options[0][OPTION_DONT_PROPAGATE];

    /** @type {{func: FunctionExpression, awaits: Set<AwaitExpression>}[]} */
    const awaitsStack = [];

    ///** @param {import("typescript").FunctionLikeDeclaration} node */
    function ProcessFunction(node) {

    }

    return {
      AwaitExpression(node) {
        awaits.add(node);
      },
      CallExpression(node) {
        //node.callee.name === "then"
      },
      "FunctionExpression:exit"(node) {
        if (node === stack[stack.length - 1])
          awaitsStack.pop();

        for (const await of awaits) {

        }
      },
      //ArrowFunctionExpression() {}
      //FunctionDeclaration
      FunctionExpression (node) {
        awaitsStack.push(node);
        // XXX: might not cover promise-returning functions as well as checking the return type
        if (!node.async)
          return;

        /** @type {import("typescript").FunctionExpression} */
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

        // XXX: won't match for example  my_namespace["ClientRequestContext"]
        const clientReqCtx = node.params.find(p => {
          const identifier
            = p.type === "Identifier"
            ? p
            : p.type === "AssignmentPattern"
            ? p.left
            : p;
          const tsParam = parserServices.esTreeNodeToTSNodeMap.get(identifier);
          try {
            return /ClientRequestContext$/.test(tsParam.parent.type.getText());
          } catch (_) {
            console.error("unknown parameter ast format")
            return;
          }
        });

        if (clientReqCtx === undefined) {
          context.report({
            node,
            messageId: "noContextArg",
          });
          return;
        }

        // do this with a stack
        function containsAwait(node) {
          // XXX: stub
          return false;
        }

        function getExpressionOuterStatement(node) {

        }

        for (let i = 0; i < node.body.body.length; ++i) {
          const stmt = node.body.body[i];
          const nextStmt = node.body.body[i+1];
          if (containsAwait(stmt) && !nextStmt.deepEquals({
            type: "ExpressionStatement",
            expression: {
              type: "CallExpression",
              optional: false,
              callee: {
                type: "MemberExpression",
                object: {
                  type: "identifier",
                  name: ""
                },
                property: {
                  type: "Identifier",
                  name: "enter"
                },
                computed: false,
                optional: false,
              },
              arguments: []
            }
          })) {
            context.report({
              node,
              messageId: "noReenterOnAwaitResume"
            });
          }
        }
      },
    };
  },
};

module.exports = rule;
