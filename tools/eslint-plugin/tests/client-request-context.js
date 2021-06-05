/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// based heavily on eslint-plugin-react-hooks's tests

"use strict";

const ESLintTester = require('eslint').RuleTester;
const BentleyESLintPlugin = require('../dist');
const ClientRequestContextESLintRule = BentleyESLintPlugin.rules["client-request-context"];

/** @param {string[]} strings */
function normalizeIndent(strings) {
  const codeLines = strings[0].split('\n');
  const leftPadding = codeLines[1].match(/\s+/)[0];
  return codeLines.map(l => l.substr(leftPadding.length)).join('\n');
}

const prelude = normalizeIndent`
interface ClientRequestContext {
  enter(): void;
}
`;

new ESLintTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  }
}).run('client-request-context', ClientRequestContextESLintRule, {
  valid: [
    {
      code: normalizeIndent`
        class C {
          async goodMethod(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
            reqCtx.enter();
          }
        }
      `,
      options: [{"dont-propagate-request-context": false}],
    },
    /*
    {
      code: normalizeIndent`
        class C {
          async dontNeedEnterIfAwaitIsLastStatement(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
          }
        }
      `,
      options: [{"dont-propagate-request-context": true}]
    }
    */
  ],
  invalid: [
    {
      code: normalizeIndent`
        class Bad {
          async badMethod(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
            const badStatement = 10;
          }
        }
      `,
      options: [{"dont-propagate-request-context": false}],
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately after resuming from an awaited statement",
          suggestions: [
            {
              desc: "Add a call to 'reqCtx.enter()' after the statement containing 'await'",
              output: normalizeIndent`
                class Bad {
                  async badMethod(reqCtx: ClientRequestContext) {
                    reqCtx.enter();
                    await Promise.resolve(5);
                    reqCtx.enter();
                    const badStatement = 10;
                  }
                }
              `,
            }
          ]
        }
      ]
    }
  ]
});
