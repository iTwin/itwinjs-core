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
function dedent(strings) {
  const textAssumingNoInterpolations = strings[0];
  const codeLines = textAssumingNoInterpolations.split("\n");
  if (codeLines.length <= 1) return textAssumingNoInterpolations;
  const leftPadding = codeLines[1].match(/[\t ]+/)[0];
  return codeLines
    .slice(1, -1)
    .map((l) => l.substr(leftPadding.length))
    .join("\n");
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
      { code: `import * as A from "./a";` },
      { code: `import {b} from "./b";` },
      { code: `import DefaultB from "./b";` },
      { code: `import DefaultB, {b} from "./b";` },
      {
        code: `import {b} from "./barrel";`,
        options: [{ "ignored-barrel-modules": ["./barrel.ts"] }],
      },
      {
        code: `import {b} from "./far/barrel";`,
        options: [{ "ignored-barrel-modules": ["./far/barrel.ts"] }],
      },
      { code: `import { barreled } from "barrel-pkg";` },
      { code: `import {A} from "./typebarrel";` },
      { code: `import {y, x} from "./external-reexports";` },
      {
        code: `import {c} from "./far/barrel";`,
        options: [{ "required-barrel-modules": ["./far/barrel.ts"] }],
      },
      {
        code: `import {a} from "./barrel";`,
        options: [{ "required-barrel-modules": ["./barrel.ts"] }],
      },
    ],
    invalid: [
      {
        code: `import {b} from "./barrel";`,
        errors: [{ messageId: "noInternalBarrelImports" }],
        output: `import { b } from "./b";`,
      },
      {
        code: `import {a, b} from "./barrel";`,
        errors: [{ messageId: "noInternalBarrelImports" }],
        output: dedent`
          import { a } from "./a";
          import { b } from "./b";
        `,
      },
      {
        code: `import {a as notA} from "./barrel";`,
        errors: [{ messageId: "noInternalBarrelImports" }],
        output: `import { a as notA } from "./a";`,
      },
      {
        code: `import {c} from "./far/barrel";`,
        errors: [{ messageId: "noInternalBarrelImports" }],
        output: `import { c } from "./far/c";`,
      },
      {
        code: `import { b3, b, c, a } from "./far/barrel";`,
        errors: [{ messageId: "noInternalBarrelImports" }],
        output: dedent`
          import { a } from "./a";
          import { b, b3 } from "./b";
          import { c } from "./far/c";
        `,
      },
      {
        code: `import {a} from "./a";`,
        options: [{ "required-barrel-modules": ["./barrel.ts"] }],
        errors: [{ messageId: "mustUseRequiredBarrels" }],
        output: `import {a} from "./barrel";`,
      },
      {
        code: `import * as X from "./a";`,
        options: [{ "required-barrel-modules": ["./barrel.ts"] }],
        errors: [{ messageId: "mustUseRequiredBarrels" }],
        output: `import * as X from "./barrel";`,
      },
    ],
  })
);
