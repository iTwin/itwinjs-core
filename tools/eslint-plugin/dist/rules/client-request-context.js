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

    const stack = [];

    ///** @param {import("@typescript-eslint/typescript-estree").TSNode} node */
    ///** @param {import("typescript").FunctionLikeDeclaration} node */
    function ProcessFunction(node) {

    }

    return {
      AwaitExpression(node) {

      },
      CallExpression(node) {
        //node.callee.name === "then"
      },
      "FunctionExpression:exit"(node) {
        if (node === stack[stack.length - 1])
          stack.pop();
      },
      //ArrowFunctionExpression() {}
      //FunctionDeclaration
      FunctionExpression (node) {
        stack.push(node);
        // XXX: might not cover promise-returning functions as well as checking the return type
        if (!node.async)
          return;

        // XXX: won't match for example  my_namespace["ClientRequestContext"]
        const ps = parserServices;
        const clientReqCtx = node.params.find(p => p.typeAnnotation.typeAnnotation.typeName.name === "ClientRequestContext");

        if (clientReqCtx === undefined) {
          context.report({
            node,
            messageId: "noContextArg",
          });
          return;getP
        }

        // do this with a stack
        function containsAwait(node) {
          // XXX: stub
          return false;
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
