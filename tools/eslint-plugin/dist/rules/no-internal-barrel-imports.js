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

fixing is currently restricted to named exports only.
*/

"use strict";

const { getParserServices } = require("./utils/parser");
const ts = require("typescript");
/** for dealing with paths on the current os */
const OsPaths = require("path");
/** for dealing with paths in typescript import specifiers */
const TsImportPaths = OsPaths.posix;

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
      return OsPaths.normalize(OsPaths.resolve(OsPaths.dirname(tsConfig), p));
    });

    return {
      ImportDeclaration(node) {
        /** @param {ts.Symbol | undefined} symbol */
        function getRelativeImportPathForExportedSymbol(symbol) {
          if (symbol === undefined) return "";
          const declaration = symbol.valueDeclaration || symbol.declarations[0];
          const fileOfExport = declaration.getSourceFile();
          const path = TsImportPaths.normalize(
            withoutExt(
              TsImportPaths.relative(
                TsImportPaths.dirname(thisModule.fileName),
                fileOfExport.fileName
              )
            )
          );
          // a path unprefixed by "./" is interpretted as from node_modules
          const ensurePrefixed = (path) =>
            path[0] === "." ? path : `./${path}`;
          return ensurePrefixed(path);
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

        const importIsPackage =
          importInfo === undefined || importInfo.isExternalLibraryImport;
        if (importIsPackage) return;

        // the path in the ts program's map is all lower case on windows,
        // but not the path generated from the cased import specifier
        const targetFilePathOfThisImportStmt =
          process.platform === "win32"
            ? importInfo.resolvedFileName.toLowerCase()
            : importInfo.resolvedFileName;

        const importedModule = program.getSourceFileByPath(
          targetFilePathOfThisImportStmt
        );

        if (!importedModule) throw Error("couldn't find imported module");

        // prettier-ignore
        if (ignoredBarrelModules.includes(OsPaths.normalize(importedModule.fileName)))
          return;

        /** @type {ts.ImportDeclaration["moduleSpecifier"][]} */
        const imports = importedModule.imports;
        const containsReExport = imports.some((importSpecifier) => {
          const isNonTypeOnlyReExport =
            ts.isExportDeclaration(importSpecifier.parent) &&
            !importSpecifier.parent.isTypeOnly;
          if (!isNonTypeOnlyReExport) return false;
          const transitiveImportInfo = importedModule.resolvedModules.get(
            importSpecifier.text
          );
          const reExportsExternalPackage =
            transitiveImportInfo === undefined ||
            transitiveImportInfo.isExternalLibraryImport;
          return !reExportsExternalPackage;
        });

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

        const namedImports =
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
            namedImports.length !== 0 && {
              fix(fixer) {
                return [
                  fixer.remove(node),
                  // first get key value pairs of a Map<ModulePaths, ImportPropsFromModule>
                  ...Array.from(
                    namedImports
                      .map((namedImport) => {
                        const symbol = checker.getSymbolAtLocation(
                          namedImport.name
                        );
                        return {
                          namedImport,
                          importPath:
                            symbol &&
                            getRelativeImportPathForExportedSymbol(
                              checker.getAliasedSymbol(symbol)
                            ),
                        };
                      })
                      .filter(({ importPath }) => importPath !== undefined)
                      .reduce((result, cur) => {
                        if (!result.has(cur.importPath))
                          result.set(cur.importPath, [cur]);
                        else result.get(cur.importPath).push(cur);
                        return result;
                      }, new Map())
                  )
                    // sort the modules (map keys)
                    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
                    // sort their imported properties (map value lists)
                    .map((import_) => {
                      // prettier-ignore
                      import_[1].sort((a, b) => a.namedImport.name.escapedText > b.namedImport.name.escapedText ? 1 : -1);
                      return import_;
                    })
                    .map(([importPath, namedImports], i) =>
                      fixer.insertTextAfter(
                        node,
                        // prettier-ignore
                        `${ i === 0 ? "" : "\n" /* separate all imported modules with a new line*/
                        }import { ${namedImports
                          .map(({ namedImport }) =>
                            namedImport.propertyName !== undefined
                              ? `${namedImport.propertyName.escapedText} as ${namedImport.name.escapedText}`
                              : namedImport.name.escapedText
                          )
                          .join(", ")} } from "${importPath}";`
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
  return TsImportPaths.join(
    TsImportPaths.dirname(inPath),
    TsImportPaths.basename(inPath).replace(/\.[^.]+$/, "")
  );
}

module.exports = rule;
