/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

"use strict";

const path = require("path");
const ESLintTester = require("eslint").RuleTester;
const BentleyESLintPlugin = require("../dist");
const NoInternalBarrelImportsESLintRule =
  BentleyESLintPlugin.rules["no-internal-barrel-imports"];

/** mostly stolen from eslint-plugin-react-hooks's test
 *  @param {string[]} strings
 */
function makeTest(strings) {
  const codeLines = strings[0].split("\n");
  if (codeLines.length <= 1) return strings;
  const leftPadding = codeLines[1].match(/\s+/)[0];
  return codeLines.map((l) => l.substr(leftPadding.length)).join("\n");
}

/** allow specifying `only` and `skip` properties for easier debugging */
function supportSkippedAndOnlyInTests(obj) {
  const hasOnly =
    obj.valid.some((test) => Boolean(test.only)) ||
    obj.invalid.some((test) => Boolean(test.only));
  const keepTest = (test) => (hasOnly ? test.only : !test.skip);
  const stripExtraTags = (test) => {
    delete test.skip;
    delete test.only;
    return test;
  };
  return {
    valid: obj.valid.filter(keepTest).map(stripExtraTags),
    invalid: obj.invalid.filter(keepTest).map(stripExtraTags),
  };
}

const fixtureDir = path.join(
  __dirname,
  "fixtures",
  "no-internal-barrel-imports"
);

const ruleTester = new ESLintTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    tsconfigRootDir: fixtureDir,
    project: path.join(fixtureDir, "./tsconfig.test.json"),
  },
});

ruleTester.run(
  "no-internal-barrel-imports",
  NoInternalBarrelImportsESLintRule,
  supportSkippedAndOnlyInTests({
    valid: [
      {
        code: makeTest`
        class C {
          async goodMethod(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
            reqCtx.enter();
          }
        }
      `,
      },
    ],
    invalid: [
      {
        only: true,
        code: makeTest`
        async function awaitInIf(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          if (await someFunc()) {
            return 10;
          }
          return 5;
        }
      `,
        errors: [
          {
            messageId: "noEnterOnAwaitResume",
            data: { reqCtxArgName: "reqCtx" },
          },
        ],
        output: makeTest`
        async function awaitInIf(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          if (await someFunc()) {reqCtx.enter();
            return 10;
          }
          return 5;
        }
      `,
      },
    ],
  })
);
