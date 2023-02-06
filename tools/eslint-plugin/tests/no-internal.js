/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

"use strict";

const path = require("path");
const ESLintTester = require("eslint").RuleTester;
const BentleyESLintPlugin = require("../dist");
const { supportSkippedAndOnlyInTests, dedent } = require("./testUtils");
const NoInternalESLintRule = BentleyESLintPlugin.rules["no-internal"];

const fixtureDir = path.join(__dirname, "fixtures", "no-internal");

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
  "no-internal",
  NoInternalESLintRule,
  supportSkippedAndOnlyInTests({
    valid: [
      {
        code: dedent`
          import { Public } from "./local";
          new Public().public();
        `,
      },
      {
        code: dedent`
          import { Public } from "test-pkg-1";
          new Public().public();
        `,
      },
    ],
    invalid: [
      {
        code: dedent`
          import { Public } from "test-pkg-1";
          new Public().internal();
        `,
        errors: [
          {
            messageId: "forbidden",
            data: {
              kind: "method",
              name: "internal",
              tag: "internal",
            },
          },
        ],
      },
      {
        code: dedent`
          import { Public } from "./local";
          new Public().internal();
        `,
        errors: [
          {
            messageId: "forbidden",
            data: {
              kind: "method",
              name: "internal",
              tag: "internal",
            },
          },
        ],
      },
      {
        code: dedent`
          import { internal } from "test-pkg-1";
          internal()
        `,
        errors: [
          {
            messageId: "forbidden",
            data: {
              kind: "function",
              name: "internal",
              tag: "internal",
            },
          },
        ],
      },
    ],
  })
);
