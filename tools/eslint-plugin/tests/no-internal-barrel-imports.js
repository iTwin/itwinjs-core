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

/** @param {string[]} strings */
function makeTest(strings) {
  const codeLines = strings[0].split("\n");
  if (codeLines.length <= 1) return strings[0];
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
    shouldCreateDefaultProgram: true,
    project: path.join(fixtureDir, "tsconfig.test.json"),
  },
});

ruleTester.run(
  "no-internal-barrel-imports",
  NoInternalBarrelImportsESLintRule,
  supportSkippedAndOnlyInTests({
    valid: [
      { code: makeTest`import * as A from "./a";` },
      { code: makeTest`import {b} from "./b";` },
      { code: makeTest`import DefaultB from "./b";` },
      { code: makeTest`import DefaultB, {b} from "./b";` },
      {
        code: makeTest`import {b} from "./barrel";`,
        options: [{"ignored-barrel-modules": ["./barrel.ts"]}],
      },
      {
        code: makeTest`import {b} from "./far-barrel/barrel";`,
        options: [{"ignored-barrel-modules": ["./far-barrel/barrel.ts"]}],
      },
    ],
    invalid: [
      {
        code: makeTest`import {b} from "./barrel";`,
        errors: [ { messageId: "noInternalBarrelImports" } ],
      },
      {
        code: makeTest`import {a as notA} from "./barrel";`,
        errors: [ { messageId: "noInternalBarrelImports" } ],
      },
      {
        code: makeTest`
          import {a as notA} from "./barrel";
        `,
        errors: [ { messageId: "noInternalBarrelImports" } ],
      },
    ],
  })
);
