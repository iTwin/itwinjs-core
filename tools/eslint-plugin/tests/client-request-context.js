/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict";

const ESLintTester = require('eslint').RuleTester;
const BentleyESLintPlugin = require('../dist');
const ClientRequestContextESLintRule = BentleyESLintPlugin.rules["client-request-context"];
const { ESLintUtils: { RuleTester } } = require('@typescript-eslint/experimental-utils');

/** mostly stolen from eslint-plugin-react-hooks's test
 *  @param {string[]} strings
 */
function normalizeIndent(strings) {
  const codeLines = strings[0].split('\n');
  const leftPadding = codeLines[1].match(/\s+/)[0];
  return codeLines.map(l => l.substr(leftPadding.length)).join('\n');
}

/** allow specifying `only` and `skip` properties for easier debugging */
function supportSkippedAndOnlyInTests(obj) {
  const hasOnly = obj.valid.some(test => Boolean(test.only)) || obj.invalid.some(test => Boolean(test.only));
  const keepTest = test => hasOnly ? test.only : !test.skip;
  const stripExtraTags = (test) => { delete test.skip; delete test.only; return test; };
  return {
    valid: obj.valid.filter(keepTest).map(stripExtraTags),
    invalid: obj.invalid.filter(keepTest).map(stripExtraTags),
  };
}

new ESLintTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: './tsconfig.test.json'
  }
}).run('client-request-context', ClientRequestContextESLintRule, supportSkippedAndOnlyInTests({
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
      only: true,
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
    {
      code: normalizeIndent`
        class C {
          async dontNeedEnterIfAwaitIsLastStatement(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
          }
        }
      `,
    },
    { code: "async function f(ctx: IMJSBackend.ClientRequestContext) {ctx.enter();}" },
    { code: "async function f(ctx: AuthorizedClientRequestContext) {ctx.enter();}" },
    { code: `async function f(ctx: Backend["ClientRequestContext"]) {ctx.enter();}`, skip: true },
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
                    await Promise.resolve(5);reqCtx.enter();
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
        async function missingFirstEnterCall(reqCtx: ClientRequestContext) {
          await Promise.resolve(5);
          reqCtx.enter();
        }
      `,
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately",
          suggestions: [
            {
              desc: "Add 'reqCtx.enter()' as the first statement of the body",
              output: normalizeIndent`
                async function missingFirstEnterCall(reqCtx: ClientRequestContext) {
                  reqCtx.enter();await Promise.resolve(5);
                  reqCtx.enter();
                }
              `,
            }
          ]
        }
      ]
    },
    {
      code: "async function missingFirstEnterCallEmptyBody(reqCtx: ClientRequestContext) {}",
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately",
          suggestions: [
            {
              desc: "Add 'reqCtx.enter()' as the first statement of the body",
              output: "async function missingFirstEnterCallEmptyBody(reqCtx: ClientRequestContext) {reqCtx.enter();}",
            }
          ]
        }
      ]
    },
    {
      // no idea how to match this without type information during tests
      // skipping for now, should check @typescript-eslint's own tests
      skip: true,
      code: normalizeIndent`
        function noEnterAtBeginImplicitAsync(reqCtx: ClientRequestContext) {
          return Promise.resolve(5);
        }
      `,
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately",
          suggestions: [
            {
              desc: "Add 'reqCtx.enter()' as the first statement of the body",
              output: normalizeIndent`
                function noEnterAtBeginImplicitAsync(reqCtx: ClientRequestContext) {
                  reqCtx.enter();return Promise.resolve(5);
                }
              `,
            }
          ]
        }
      ]
    },
    {
      code: "async function f() {}",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "async function f(clientRequestContext: ClientRequestContext) {}",
            },
          ]
        },
      ]
    },
    {
      code: "async function f(arg1: string) {}",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "async function f(clientRequestContext: ClientRequestContext, arg1: string) {}",
            },
          ]
        },
      ]
    },
    {
      options: [{"context-arg-name": "ctx"}],
      code: "async function f() {}",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "async function f(ctx: ClientRequestContext) {}",
            },
          ]
        },
      ]
    },
    {
      code: "async function asyncMethod(otherArg: number) {}",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "async function asyncMethod(clientRequestContext: ClientRequestContext, otherArg: number) {}",
            },
          ]
        }
      ]
    },
    {
      // not sure how to test this one, (need ESLintRuleTest to have type info)
      // should check @typescript-eslint's own rule testing
      skip: true,
      code: normalizeIndent`
        function implicitlyAsync(reqCtx: ClientRequestContext) {
          return Promise.resolve();
        }
      `,
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately after resuming from an awaited statement",
          suggestions: [
            {
              desc: "Add a call to 'reqCtx.enter()' at the beginning of the function block",
              output: normalizeIndent`
                function implicitlyAsync(reqCtx: ClientRequestContext) {
                reqCtx.enter();
                  return Promise.resolve();
                }
              `,
            }
          ]
        }
      ]
    },
    {
      code: "async function asyncFunc() {}",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "async function asyncFunc(clientRequestContext: ClientRequestContext) {}",
            }
          ]
        }
      ]
    },
    {
      code: "class C { async asyncMethod() {} }",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "class C { async asyncMethod(clientRequestContext: ClientRequestContext) {} }",
            }
          ]
        }
      ]
    },
    {
      code: "function promiseReturning(): Promise<void> { return Promise.resolve(); }",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "function promiseReturning(clientRequestContext: ClientRequestContext): Promise<void> { return Promise.resolve(); }",
            }
          ]
        }
      ]
    },
    {
      // testing implicit promise return type not supported yet
      skip: true,
      code: "function implicitPromiseReturning() { return Promise.resolve(); }",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "function implicitPromiseReturning(clientRequestContext: ClientRequestContext) { return Promise.resolve(); }",
            }
          ]
        }
      ]
    },
    {
      code: "const asyncArrow = async () => {};",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "const asyncArrow = async (clientRequestContext: ClientRequestContext) => {};",
            }
          ]
        }
      ]
    },
    {
      code: "const promiseReturningArrow = (): Promise<void> => { return Promise.resolve(); };",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "const promiseReturningArrow = (clientRequestContext: ClientRequestContext): Promise<void> => { return Promise.resolve(); };",
            }
          ]
        }
      ]
    },
    {
      code: "const implicitPromiseReturningArrow = () => { return Promise.resolve(); };",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "const implicitPromiseReturningArrow = (clientRequestContext: ClientRequestContext) => { return Promise.resolve(); };",
            }
          ]
        }
      ]
    },
    {
      //only: true,
      code: "const typedButNoReturnTypeArrow: (() => Promise<void>) = () => { return Promise.resolve(); };",
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: "const typedButNoReturnTypeArrow: (clientRequestContext: ClientRequestContext) => Promise<void> = (clientRequestContext: ClientRequestContext) => { return Promise.resolve(); };",
            }
          ]
        }
      ]
    },
    {
      // this should eventually test dont-propagate-request-context settings
      skip: true,
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
  ]
}));
