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
    },
    {
      code: normalizeIndent`
        async function goodFreeFunc(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          await Promise.resolve(5);
          reqCtx.enter();
        }
      `,
    },
    {
      code: normalizeIndent`
        const goodArrowFunc = async (reqCtx: ClientRequestContext) => {
          reqCtx.enter();
          await Promise.resolve(5);
          reqCtx.enter();
        }
      `,
    },
    {
      code: normalizeIndent`
        function goodNonAsyncFunc(reqCtx: ClientRequestContext): Promise<number> {
          reqCtx.enter();
          return Promise.resolve(5);
        }
      `,
    },
    {
      code: normalizeIndent`
        function goodNonAsyncImplicitReturnTypeFunc(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve(5);
        }
      `,
    },
    {
      code: normalizeIndent`
        function goodThenCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve(5);
        }
      `,
    },
    {
      code: normalizeIndent`
        function goodCatchCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          const promise = fetch()
            .then(() => {
              reqCtx.enter();
              const otherStuff = 5;
            })
            .catch(() => {
              reqCtx.enter();
              const otherStuff = 5;
            });
          return promise;
        }
      `,
    },
    {
      code: normalizeIndent`
        function nonAsyncThen(reqCtx: ClientRequestContext) {
          getPromise().then(() => {
            const notAnEnter = 5;
          });
        }
      `,
    },
    {
      code: normalizeIndent`
        function goodAsyncCatch(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          try {
            return Promise.resolve("success");
          } catch (err) {
            reqCtx.enter();
            return Promise.resolve("caught");
          }
        }
      `,
    },
    {
      code: normalizeIndent`
        function goodAsyncFinally(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          try {
            const x = 5 + 1;
          } catch (err) {
            reqCtx.enter();
          } finally {
            reqCtx.enter();
            return Promise.resolve(5);
          }
        }
      `,
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
    },
    {
      code: normalizeIndent`
        class C {
          async missingFirst(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
            reqCtx.enter();
          }
        }
      `,
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
    },
    {
      code: normalizeIndent`
        function badNonAsyncImplicitReturnTypeFunc(reqCtx: ClientRequestContext) {
          return Promise.resolve(5);
        }
      `,
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately",
          suggestions: [
            {
              desc: "Add a call to 'reqCtx.enter()' after the statement containing 'await'",
              output: normalizeIndent`
                function badNonAsyncImplicitReturnTypeFunc(reqCtx: ClientRequestContext) {
                reqCtx.enter();
                  return Promise.resolve(5);
                }
              `,
            }
          ]
        }
      ]
    },
  ]
});
