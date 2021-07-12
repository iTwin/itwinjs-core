/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
Within a package, you can create cyclic dependencies by doing the following:

```ts
// file A.ts
export * from "B";
export * from "C";
```

```ts
// file B.ts
export default function b() { return 2; }
```

```ts
// file C.ts
import {b} from "A";
import * as A from "A";
export default function c() { return 1 + b() + A.b(); }
```

This rule reports uses of re-exports, in order to prevent such cyclic dependency issues.
It considers any file containing a `re-export` (e.g. `export ... from ...`) to be a barrel file,
excluding typed re-exports (e.g. `export type {MyType} from "./SomeModule"`).

It does not currently report general re-exporting such as the following:

```ts
import {a} from "A";
import {b} from "B";
export {a, b};
```
*/

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");
const path = require("path");

const OPTION_IGNORED_BARREL_MODULES = "ignored-barrel-modules";

const messages = {
  noInternalBarrelImports: `Do not consume barrel imports within the same package`,
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
    const checker = program.getTypeChecker();
    const maybeTsConfig = program.getCompilerOptions().configFilePath;

    const extraOpts = context.options[0];
    const ignoredBarrelModules = (
      (maybeTsConfig &&
        extraOpts &&
        extraOpts[OPTION_IGNORED_BARREL_MODULES]) ||
      []
    ).map((p) => {
      /** @type {string} earlier check means it is definitely a string */
      const tsConfig = maybeTsConfig;
      return path.resolve(path.dirname(tsConfig), p);
    });

    return {
      ImportDeclaration(node) {
        /** @param {ts.Symbol} symbol */
        function getRelativeImportForExportedSymbol(symbol) {
          if (symbol === undefined) return "";
          const declaration = symbol.valueDeclaration || symbol.declarations[0];
          const fileOfExport = declaration.getSourceFile();
          return (
            "./" +
            withoutExt(
              path.relative(
                path.dirname(thisModule.fileName),
                fileOfExport.fileName
              )
            )
          );
        }

        if (typeof node.source.value !== "string")
          throw Error("Invalid input source");

        /** @type{ts.ImportDeclaration} */
        const importNodeTs = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!importNodeTs)
          throw Error("equivalent typescript node could not be found");

        if (importNodeTs.importClause && importNodeTs.importClause.isTypeOnly)
          return;

        const thisModule = importNodeTs.getSourceFile();

        if (!thisModule.resolvedModules.has(importNodeTs.moduleSpecifier.text))
          throw Error("module did not have this import");

        const importInfo = thisModule.resolvedModules.get(
          importNodeTs.moduleSpecifier.text
        );

        const importIsPackage = importInfo === undefined;
        if (importIsPackage) return;

        const importedModule = program.getSourceFileByPath(
          importInfo.resolvedFileName
        );
        if (!importedModule) throw Error("couldn't find imported module");

        if (ignoredBarrelModules.includes(importedModule.fileName)) return;

        if (importInfo.isExternalLibraryImport) return;

        const containsReExport = importedModule.imports.some(
          (imp) => ts.isExportDeclaration(imp.parent) && !imp.parent.isTypeOnly
        );

        const hasNamespaceImport =
          importNodeTs.importClause &&
          importNodeTs.importClause.namedBindings &&
          importNodeTs.importClause.namedBindings.kind ===
            ts.SyntaxKind.NamespaceImport;

        // there may be some situations where not reporting this is preferable
        const isSideEffectImport =
          !importNodeTs.importClause ||
          (importNodeTs.importClause.name === undefined &&
            importNodeTs.importClause.namedBindings === undefined);

        // there may be some situations where not reporting this is preferable
        const hasDefaultImport =
          importNodeTs.importClause &&
          importNodeTs.importClause.name !== undefined;

        if (!containsReExport) return;

        const importedProps =
          importNodeTs.importClause &&
          importNodeTs.importClause.namedBindings &&
          ts.isNamedImports(importNodeTs.importClause.namedBindings)
            ? importNodeTs.importClause.namedBindings.elements
            : [];

        context.report({
          node,
          messageId: messageIds.noInternalBarrelImports,
          // fixer only supports property imports
          ...(!hasDefaultImport &&
            !isSideEffectImport &&
            !hasNamespaceImport &&
            importedProps.length !== 0 && {
              fix(fixer) {
                return [
                  fixer.remove(node),
                  ...importedProps
                    .map((importedProp) => ({
                      importedProp,
                      symbol: checker.getSymbolAtLocation(importedProp.name),
                    }))
                    .filter(({ symbol }) => symbol !== undefined)
                    .map(({ importedProp, symbol }) =>
                      fixer.insertTextAfter(
                        node,
                        `;import {${
                          importedProp.propertyName !== undefined
                            ? `${importedProp.propertyName.escapedText} as ${importedProp.name.escapedText}`
                            : importedProp.name.escapedText
                        }} from "${getRelativeImportForExportedSymbol(
                          checker.getAliasedSymbol(symbol)
                        )}";`
                      )
                    ),
                ];
              },
            }),
        });
      },
    };
  },
};

/**
 * return a filename without its extension (e.g.) "path/blah.ts" => "path/blah"
 * @param {string} inPath
 * @returns {string}
 */
function withoutExt(inPath) {
  return path.join(
    path.dirname(inPath),
    path.basename(inPath).replace(/\.[^.]+$/, "")
  );
}

module.exports = rule;
