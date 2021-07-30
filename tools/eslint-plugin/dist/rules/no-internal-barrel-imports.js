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
const OPTION_REQUIRED_BARREL_MODULES = "required-barrel-modules";

const messages = {
  noInternalBarrelImports:
    "Do not consume barrel imports within the same package",
  mustUseRequiredBarrels:
    "You must import from the configured required barrel module, '{{barrelPath}}'",
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
          [OPTION_REQUIRED_BARREL_MODULES]: {
            type: "array",
            description:
              "Paths to barrel modules for which it is illegal to import sibling modules, the barrel must be imported. " +
              "This allows the forcing of dependency order which can be used to resolve cyclic dependencies. " +
              'A "sibling" Module is any module in that is a descendant of the containing directory of the barrel. ',
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
    const { ignoredBarrelModules = [], requiredBarrelModules = [] } =
      typeof maybeTsConfig === "string" && extraOpts
        ? {
            ignoredBarrelModules:
              extraOpts[OPTION_IGNORED_BARREL_MODULES] &&
              resolvePathsOption(
                extraOpts[OPTION_IGNORED_BARREL_MODULES],
                maybeTsConfig
              ),
            requiredBarrelModules:
              extraOpts[OPTION_REQUIRED_BARREL_MODULES] &&
              resolvePathsOption(
                extraOpts[OPTION_REQUIRED_BARREL_MODULES],
                maybeTsConfig
              ),
          }
        : {};

    return {
      ImportDeclaration(node) {
        /** @param {ts.Symbol | undefined} symbol */
        function getRelativeImportPathForExportedSymbol(symbol) {
          if (symbol === undefined) return "";
          const declaration = symbol.valueDeclaration || symbol.declarations[0];
          const fileOfExport = declaration.getSourceFile();
          return fileToImportPath(thisModule.fileName, fileOfExport.fileName);
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

        const importInfo = ts.getResolvedModule(
          thisModule,
          importNodeTs.moduleSpecifier.text
        );

        const importIsPackage =
          importInfo === undefined || importInfo.isExternalLibraryImport;
        if (importIsPackage) return;

        // path case can be different between the cased import specifier, and the resolved system path
        // use lower case on OSs known to use lower cased file systems (e.g. windows and mac but not linux)
        const targetFilePathOfThisImportStmt =
          process.platform === "win32" || process.platform === "darwin"
            ? importInfo.resolvedFileName.toLowerCase()
            : importInfo.resolvedFileName;

        const importedModule = program.getSourceFileByPath(
          targetFilePathOfThisImportStmt
        );

        if (!importedModule) throw Error("couldn't find imported module");

        const normedImportModulePath = OsPaths.normalize(
          importedModule.fileName
        );

        const requiredBarrelModule = requiredBarrelModules.find(
          (barrelModule) =>
            pathContains(OsPaths.dirname(barrelModule), normedImportModulePath)
        );
        const importIsSiblingOfRequiredBarrel =
          requiredBarrelModule !== undefined;

        const importIsFromRequiredBarrelModule =
          requiredBarrelModule === normedImportModulePath;

        if (importIsFromRequiredBarrelModule) return;

        if (importIsSiblingOfRequiredBarrel) {
          context.report({
            node,
            messageId: messageIds.mustUseRequiredBarrels,
            data: { barrelPath: requiredBarrelModule },
            fix(fixer) {
              // TODO: could be improved to check the re-exported name in case it was changed
              if (importNodeTs.importClause)
                return fixer.replaceText(
                  node,
                  `import ${importNodeTs.importClause.getText()} from "${fileToImportPath(
                    thisModule.fileName,
                    requiredBarrelModule
                  )}";`
                );
              else return fixer.remove(node);
            },
          });
          return;
        }

        // prettier-ignore
        if (ignoredBarrelModules.includes(OsPaths.normalize(importedModule.fileName)))
          return;

        let containsReExport = false;
        ts.forEachChild(importedModule, (child) => {
          const potentialReExport =
            ts.isExportDeclaration(child) &&
            child.moduleSpecifier !== undefined &&
            !child.isTypeOnly;
          if (!potentialReExport) return;
          const transitiveImportInfo = ts.getResolvedModule(
            importedModule,
            child.moduleSpecifier.text
          );
          const reExportsExternalPackage =
            transitiveImportInfo === undefined ||
            transitiveImportInfo.isExternalLibraryImport;
          const isReExport = potentialReExport && !reExportsExternalPackage;
          containsReExport = isReExport;
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

        /** @param {import("eslint").Rule.RuleFixer} fixer */
        function fix(fixer) {
          const modulesToImportStmtsMap = namedImports
            .map((namedImport) => {
              const symbol = checker.getSymbolAtLocation(namedImport.name);
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
            }, new Map());

          const newImportStmtsText = [...modulesToImportStmtsMap]
            // sort the modules (get keys in the map as a list and sort)
            .sort((a, b) => (a[0] > b[0] ? 1 : -1))
            // for each one, sort their named imports (sort each value of the map)
            .map((import_) => {
              // prettier-ignore
              import_[1].sort((a, b) => a.namedImport.name.escapedText > b.namedImport.name.escapedText ? 1 : -1);
              return import_;
            })
            .map(
              ([importPath, namedImports], i) =>
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
            .join("");
          return fixer.replaceText(node, newImportStmtsText);
        }

        const canFix =
          !hasDefaultImport &&
          !isSideEffectImport &&
          !hasNamespaceImport &&
          namedImports.length !== 0;

        /** @type {import("eslint").Rule.ReportDescriptor} */
        const reportDesc = {
          node,
          messageId: messageIds.noInternalBarrelImports,
        };

        if (canFix) reportDesc.fix = fix;

        context.report(reportDesc);
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

/**
 * @param {string[]} pathArray
 * @param {string} tsConfigPath
 */
function resolvePathsOption(pathArray, tsConfigPath) {
  return pathArray.map((path) =>
    OsPaths.normalize(OsPaths.resolve(OsPaths.dirname(tsConfigPath), path))
  );
}

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
function pathContains(parent, child) {
  const relative = OsPaths.relative(parent, child);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !OsPaths.isAbsolute(relative)
  );
}

/**
 * given a typescript file path, and a path to a typescript file that the first file wants to import,
 * return the import path that should be used in the import statement.
 * @param {string} importerPath - the path of the typescript file that wants to import something
 * @param {string} filePath - the path of the typescript file that importerPath wants to import
 * @returns {string}
 */
function fileToImportPath(importerPath, filePath) {
  // a path unprefixed by "./" is interpretted as from node_modules, so we must prefix it
  const ensurePrefixed = (path) => (path[0] === "." ? path : `./${path}`);
  return ensurePrefixed(
    TsImportPaths.normalize(
      tsPathFromOsPath(
        withoutExt(OsPaths.relative(OsPaths.dirname(importerPath), filePath))
      )
    )
  );
}

/**
 * given a relative os path, return a typescript compatible (posix) path
 * @param {string} path
 * @returns {string}
 */
function tsPathFromOsPath(path) {
  return path.split(OsPaths.sep).join(TsImportPaths.sep);
}

module.exports = rule;
