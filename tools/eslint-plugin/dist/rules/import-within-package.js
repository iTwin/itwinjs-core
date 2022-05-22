/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Writing all of these eslint rules in javascript so we can run them before the build step

"use strict";

const path = require("path");
const fs = require("fs");

/**
 * This rule prevents the use of import statements that refer to other packages in the monorepo through path manipulation.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent the use of import statements that refer to other packages in the monorepo through path manipulation.",
      category: "TypeScript",
    }
  },

  create(context) {
    function findPackageJson(current) {
      let prev;
      do {
        const fileName = path.join(current, "package.json");
        if (fs.existsSync(fileName)) {
          return fileName;
        }
        prev = current;
        current = path.dirname(current);
      } while (prev !== current);
      return undefined;
    }

    function getParentCount(frompath) {
      let ps = 0;
      for (const p of frompath) {
        if (p === "..")
          ps++;
      }
      return ps;
    }

    return {
      ImportDeclaration(node) {
        const pathComponents = node.source.value.split("/");

        if (pathComponents[0] === "..") {
          const packageJsonPath = findPackageJson(path.resolve(path.dirname(context.getFilename())));

          if (packageJsonPath) {
            const packageDir = path.dirname(packageJsonPath);
            const localPath = context.getFilename().substring(packageDir.length + 1);
            const localComponents = localPath.split(path.sep);

            const allowed = localComponents.length - 1;
            if (getParentCount(pathComponents) > allowed) {
              context.report({
                node,
                message: "Imports beyond package boundary are not allowed"
              });
            }
          }
        }
      },
    };
  }
}
