/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

/**
 * This rule enforces the use of get-accessors in place of methods for functions starting with "is", "has", or "want",
 * such that they may be accessed as properties of the object.
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require the use of get-accessors in place of methods for functions starting with 'is', 'has', or 'want'.",
      category: "TypeScript",
    }
  },

  create(context) {
    function isPublic(node) {
      return (node.accessibility || "public") === "public"; // assume no modifier means public by default
    }

    function returnsTypeGuard(node) {
      if (!node.value.returnType || !node.value.returnType.typeAnnotation)
        return false;
      if (node.value.returnType.typeAnnotation.type === "TSTypePredicate")
        return true;
      return false;
    }

    function hasGetterName(name) {
      if (typeof name !== "string")
        return false;
      if ((name.length > 2 && name.slice(0, 2) === "is" && name.charAt(2) === name.charAt(2).toUpperCase()) ||
        (name.length > 3 && name.slice(0, 3) === "has" && name.charAt(3) === name.charAt(3).toUpperCase()) ||
        (name.length > 4 && name.slice(0, 4) === "want" && name.charAt(4) === name.charAt(4).toUpperCase())) {
        return true;
      }
      return false;
    }

    return {
      MethodDefinition(node) {
        if (node.value.params && node.value.params.length !== 0)
          return;
        if (!isPublic(node) || returnsTypeGuard(node))
          return;
        if (node.kind === "get")
          return;

        if (hasGetterName(node.key.name)) {
          context.report({
            node,
            message: "Consider making this method an accessor. If the value is expensive to compute, consider renaming the method instead."
          });
        }
      }
    };
  },
}