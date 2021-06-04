/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

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
    const dontPropagate = context.options[0][OPTION_DONT_PROPAGATE];

    /** @param {import("@typescript-eslint/typescript-estree").TSNode} node */
    function isThisSetState(node) {
      if (node.type !== "CallExpression") return false;
      const callee = node.callee;
      return (
        callee.type === "MemberExpression" &&
        callee.object.type === "ThisExpression" &&
        callee.property.name === "setState"
      );
    }

    function getFirstSetStateAncestor(node) {
      if (!node.parent) return undefined;
      if (isThisSetState(node)) return node;
      return getFirstSetStateAncestor(node.parent);
    }

    function isInSetStateUpdater(node) {
      const setState = getFirstSetStateAncestor(node.parent);
      if (!setState) return false;
      const [updaterArgument] = setState.arguments;
      let ancestorNode = node.parent;
      while (ancestorNode) {
        if (ancestorNode === updaterArgument) return true;
        ancestorNode = ancestorNode.parent;
      }
      return false;
    }

    return {

      /** @param {import("typescript").FunctionLikeDeclaration} node */
      FunctionDeclaration(node) {
        // XXX: might not cover promise-returning functions as well as checking the return type
        if (!node.async)
          return;

        // XXX: won't match for example  my_namespace["ClientRequestContext"]
        if (node.value.returnType.typeAnnotation.value === "ClientRequestContext")
        const clientReqCtx = node.parameters.find(p => p.value.typeAnnotation === "ClientRequestContext");

        if (clientReqCtx === undefined)
          context.report({
            node,
            messageId: "noContextArg"
          });
      }
    };
  },
};

module.exports = rule;
