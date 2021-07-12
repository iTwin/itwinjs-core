/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
Within a package, you can create cyclic dependencies by doing the following:

// file A.ts
export * from "B";
export * from "C";
// the following style of barrel import is *not currently supported*
import * as b from "B";
import * as c from "C";
export {a, b};

// file B.ts
export default function b() { return 2; }

// file C.ts
import {b} from "A";
import * as A from "A";
export default function c() { return 1 + b() + A.b(); }

This rule reports uses of re-exports, in order to prevent such cyclic dependency issues.
*/

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");
const path = require("path");

const OPTION_IGNORED_BARREL_MODULES = "ignored-barrel-modules";

const messages = {
  noInternalBarrelImports: `You may not use barrel imports internally`,
};

/** @type {typeof messages} */
const messageIds = Object.keys(messages).reduce((obj, key) => {
  obj[key] = key;
  return obj;
}, {});

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Reports uses of re-exports within a package, in order to prevent such cyclic dependencies.",
      category: "TypeScript",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          /**
           * This option may be replaced in the future with "required-barrel-modules", which
           * indicates that all modules importing a symbol re-exported by that barrel module
           * must import it from the barrel module, and from nowhere else. In some complicated dependency situations,
           * forcing usage of a barrel module will enforce a particular dependency order. Modules that are imported by the barrel
           * file will not need to import sibling modules from the barrel.
           */
          [OPTION_IGNORED_BARREL_MODULES]: {
            type: "array",
            description: "Usage of re-exports from these paths are ignored.",
            default: [],
          },
        },
      },
    ],
    fixable: "code",
    messages,
  },

  create(context) {
    const parserServices = getParserServices(context);
    /** @type {ts.Program} */
    const program = parserServices.program;
    const extraOpts = context.options[0];
    const maybeTsConfig = program.getCompilerOptions().configFilePath;
    const ignoredBarrelModules = (
      (maybeTsConfig && extraOpts && extraOpts[OPTION_IGNORED_BARREL_MODULES]) ||
      []
    ).map((p) => {
      /** @type {string} earlier check means it is definitely a string */
      const tsConfig = maybeTsConfig;
      return path.resolve(path.dirname(tsConfig), p)
    });

    return {
      ImportDeclaration(node) {
        if (typeof node.source.value !== "string")
          throw Error("Invalid input source");

        const importNodeTs = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!importNodeTs)
          throw Error("equivalent typescript node could not be found");

        if (importNodeTs.importClause.isTypeOnly) return;

        const thisModule = importNodeTs.getSourceFile();
        const importInfo = thisModule.resolvedModules.get(
          importNodeTs.moduleSpecifier.text
        );
        const importedModule = program.getSourceFileByPath(
          importInfo.resolvedFileName
        );
        if (!importedModule) throw Error("couldn't find imported module");

        if (ignoredBarrelModules.includes(importedModule.resolvedPath)) return;

        if (importInfo.isExternalLibraryImport) return;

        const containsReExport = importedModule.imports.some((imp) =>
          ts.isExportDeclaration(imp.parent)
        );
        if (containsReExport) {
          context.report({
            node,
            messageId: messageIds.noInternalBarrelImports,
          });
        }
      },
    };
  },
};

module.exports = rule;
