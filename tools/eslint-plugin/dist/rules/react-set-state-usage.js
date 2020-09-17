/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// This code has been adapted from
// [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const OPTION_UPDATER_ONLY = "updater-only"
const OPTION_ALLOW_OBJECT = "allow-object";

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require the setState function to be called with function as the first argument and without 'this.props' nor 'this.state' access within the function.",
      category: "TypeScript",
      schema: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            [OPTION_UPDATER_ONLY]: {
              type: "boolean"
            },
            [OPTION_ALLOW_OBJECT]: {
              type: "boolean"
            }
          }
        }
      ]
    },
    messages: {
      failure: "Do not pass an object into setState. Use functional setState updater instead.",
      failureUpdaterOnly: "Do not use callback parameter in setState. Use componentDidUpdate method instead (\"updater-only\" switch).",
      failureAccessedMember: "Do not access 'this.{{accessedMember}}' in setState. Use arguments from callback function instead.",
    }
  },

  create(context) {
    const updaterOnly = context.options[0][OPTION_UPDATER_ONLY];
    const allowObject = context.options[0][OPTION_ALLOW_OBJECT];

    function isThisSetState(node) {
      if (node.type !== "CallExpression")
        return false;
      const callee = node.callee;
      return callee.type === "MemberExpression"
        && callee.object.type === "ThisExpression"
        && callee.property.name === "setState";
    }

    function getFirstSetStateAncestor(node) {
      if (!node.parent)
        return undefined;
      if (isThisSetState(node))
        return node;
      return getFirstSetStateAncestor(node.parent);
    }

    function isInSetStateUpdater(node) {
      const setState = getFirstSetStateAncestor(node.parent);
      if (!setState)
        return false;
      const [updaterArgument] = setState.arguments;
      let ancestorNode = node.parent;
      while (ancestorNode) {
        if (ancestorNode === updaterArgument)
          return true;
        ancestorNode = ancestorNode.parent;
      }
      return false;
    }

    return {
      CallExpression(node) {
        if (!isThisSetState(node))
          return;

        // Forbid object literal
        const [updaterArgument, callbackArgument] = node.arguments;
        if (!allowObject && updaterArgument.type === "ObjectExpression") {
          context.report({
            node: updaterArgument,
            messageId: "failure",
          });
        }

        // Forbid second argument if updaterOnly flag is set
        if (updaterOnly && node.arguments.length > 1) {
          context.report({
            node: callbackArgument,
            messageId: "failureUpdaterOnly",
          });
        }
      },

      MemberExpression(node) {
        if (node.type !== "MemberExpression"
          || node.object.type !== "ThisExpression"
          || node.property.name !== "state" && node.property.name !== "props")
          return;

        if (isInSetStateUpdater(node)) {
          context.report({
            node,
            messageId: "failureAccessedMember",
            data: { accessedMember: node.property.name }
          });
        }
      }
    };
  },
}