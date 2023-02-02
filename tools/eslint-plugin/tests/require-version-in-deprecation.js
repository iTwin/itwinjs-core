/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict";

const path = require("path");
const ESLintTester = require("eslint").RuleTester;
const BentleyESLintPlugin = require("../dist");
const RequireVersionInDeprecationESLintRule =
  BentleyESLintPlugin.rules["require-version-in-deprecation"];

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

const ruleTester = new ESLintTester({
  parser: require.resolve("@typescript-eslint/parser"),
  parserOptions: {
    ecmaVersion: 6,
  },
});

ruleTester.run(
  "require-version-in-deprecation",
  RequireVersionInDeprecationESLintRule,
  supportSkippedAndOnlyInTests({
    valid: [
      {
        code: `/**
      * @beta
      * @deprecated in 3.x. Use XYZ instead, see https://www.google.com/ for more details.
      */`
      },
      {
        code: `/**
        * @deprecated in 3.x, use XYZ instead
        * @beta
        */`
      },
      {
        code: `// @deprecated in 3.6 Use XYZ instead.`
      },
      {
        code: `/* @deprecated in 2.x. Use xyz instead. */`
      },
      {
        code: `// @deprecated in 2.x, use xyz instead
        function canWeUseFunctions() {}`
      },
      {
        code: `// @deprecated in 3.6. Use xyz instead.
        class canWeUseAClass {};`
      },
      {
        code: `/* @deprecated in 2.x Use XYZ */
        let canWeUseArrowFunction = () => {};`
      },
      {
        code: `/**
        * @deprecated in 3.x. Please use XYZ.
        */
        export interface canWeUseInterface {}`
      },
      {
        code: `/* @deprecated in 2.x. Use xyz instead. */
        namespace canWeUseNamespaces {}`
      },
      {
        code: `// @deprecated in 3.6 Use XYZ instead.
        export enum canWeUseEnum {}`
      },

    ],
    invalid: [
      {
        code: `/**
        * @beta
        * @deprecated
        */`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `// @deprecated`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `// @deprecated in 3.x.`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `/* @deprecated */`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `/* @deprecated in 2.6.*/
        function shouldFailSinceNoSentence() {}`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `// @deprecated in 3.x
        let shouldFailSinceNoSentenceGiven = () => {};`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `// @deprecated
        class shouldFailSinceNoVersionOrSentenceGiven {};`,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },
      {
        code: `/** @deprecated in 3.6.
        * I am giving the description here.
        */
         `,
        errors: [{ messageId: "requireVersionAndSentence" }],
      },

    ],
  })
);
