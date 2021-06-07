/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict";

const ESLintTester = require('eslint').RuleTester;
const BentleyESLintPlugin = require('../dist');
const ClientRequestContextESLintRule = BentleyESLintPlugin.rules["client-request-context"];

// TODO: see if we can automatically inject a prelude into the parser options instead of using this
const prelude = `
import * as IMJSBackend from "./backend";
import { ClientRequestContext, AuthorizedClientRequestContext } from "./backend";
`;

/** mostly stolen from eslint-plugin-react-hooks's test
 *  @param {string[]} strings
 */
function makeTest(strings) {
  const codeLines = strings[0].split('\n');
  if (codeLines.length <= 1)
    return prelude + strings;
  const leftPadding = codeLines[1].match(/\s+/)[0];
  return prelude + codeLines.map(l => l.substr(leftPadding.length)).join('\n');
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
    {
      code: makeTest`
        async function goodFreeFunc(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          await Promise.resolve(5);
          reqCtx.enter();
        }
      `,
    },
    {
      code: makeTest`
        const goodArrowFunc = async (reqCtx: ClientRequestContext) => {
          reqCtx.enter();
          await Promise.resolve(5);
          reqCtx.enter();
        }
      `,
    },
    {
      code: makeTest`
        function goodNonAsyncFunc(reqCtx: IMJSBackend.ClientRequestContext): Promise<number> {
          reqCtx.enter();
          return Promise.resolve(5);
        }
      `,
    },
    {
      code: makeTest`
        function goodNonAsyncImplicitReturnTypeFunc(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve(5);
        }
      `,
    },
    {
      code: makeTest`
        function goodThenCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve(5);
        }
      `,
    },
    {
      code: makeTest`
        async function fetch(ctx: ClientRequestContext) {ctx.enter();}

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
      code: makeTest`
        function nonAsyncThen(reqCtx: ClientRequestContext) {
          getPromise().then(() => {
            const notAnEnter = 5;
          });
        }
      `,
    },
    {
      code: makeTest`
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
      code: makeTest`
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
      code: makeTest`
        class C {
          async dontNeedEnterIfAwaitIsLastStatement(reqCtx: ClientRequestContext) {
            reqCtx.enter();
            await Promise.resolve(5);
          }
        }
      `,
    },
    { code: makeTest`async function f(ctx: IMJSBackend.ClientRequestContext) {ctx.enter();}` },
    { code: makeTest`async function f(ctx: AuthorizedClientRequestContext) {ctx.enter();}` },
    { code: makeTest`async function f(ctx: typeof IMJSBackend["ClientRequestContext"]) {ctx.enter();}` },
  ],
  invalid: [
    {
      code: makeTest`
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
              output: makeTest`
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
      code: makeTest`
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
              output: makeTest`
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
      code: makeTest`async function missingFirstEnterCallEmptyBody(reqCtx: ClientRequestContext) {}`,
      errors: [
        {
          message: "All promise-returning functions must call 'enter' on their ClientRequestContext immediately",
          suggestions: [
            {
              desc: "Add 'reqCtx.enter()' as the first statement of the body",
              output: makeTest`async function missingFirstEnterCallEmptyBody(reqCtx: ClientRequestContext) {reqCtx.enter();}`,
            }
          ]
        }
      ]
    },
    {
      // no idea how to match this without type information during tests
      // skipping for now, should check @typescript-eslint's own tests
      skip: true,
      code: makeTest`
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
              output: makeTest`
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
      code: makeTest`async function f() {}`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`async function f(clientRequestContext: ClientRequestContext) {}`,
            },
          ]
        },
      ]
    },
    {
      code: makeTest`async function f(arg1: string) {}`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`async function f(clientRequestContext: ClientRequestContext, arg1: string) {}`,
            },
          ]
        },
      ]
    },
    {
      options: [{"context-arg-name": "ctx"}],
      code: makeTest`async function f() {}`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`async function f(ctx: ClientRequestContext) {}`,
            },
          ]
        },
      ]
    },
    {
      code: makeTest`async function asyncMethod(otherArg: number) {}`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`async function asyncMethod(clientRequestContext: ClientRequestContext, otherArg: number) {}`,
            },
          ]
        }
      ]
    },
    {
      // not sure how to test this one, (need ESLintRuleTest to have type info)
      // should check @typescript-eslint's own rule testing
      skip: true,
      code: makeTest`
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
              output: makeTest`
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
      code: makeTest`async function asyncFunc() {}`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`async function asyncFunc(clientRequestContext: ClientRequestContext) {}`,
            }
          ]
        }
      ]
    },
    {
      code: makeTest`class C { async asyncMethod() {} }`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`class C { async asyncMethod(clientRequestContext: ClientRequestContext) {} }`,
            }
          ]
        }
      ]
    },
    {
      code: makeTest`function promiseReturning(): Promise<void> { return Promise.resolve(); }`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`function promiseReturning(clientRequestContext: ClientRequestContext): Promise<void> { return Promise.resolve(); }`,
            }
          ]
        }
      ]
    },
    {
      // testing implicit promise return type not supported yet
      skip: true,
      code: makeTest`function implicitPromiseReturning() { return Promise.resolve(); }`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`function implicitPromiseReturning(clientRequestContext: ClientRequestContext) { return Promise.resolve(); }`,
            }
          ]
        }
      ]
    },
    {
      code: makeTest`const asyncArrow = async () => {};`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`const asyncArrow = async (clientRequestContext: ClientRequestContext) => {};`,
            }
          ]
        }
      ]
    },
    {
      code: makeTest`const promiseReturningArrow = (): Promise<void> => { return Promise.resolve(); };`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`const promiseReturningArrow = (clientRequestContext: ClientRequestContext): Promise<void> => { return Promise.resolve(); };`,
            }
          ]
        }
      ]
    },
    {
      code: makeTest`const implicitPromiseReturningArrow = () => { return Promise.resolve(); };`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`const implicitPromiseReturningArrow = (clientRequestContext: ClientRequestContext) => { return Promise.resolve(); };`,
            }
          ]
        }
      ]
    },
    {
      // note that this won't fix the type, that's an error that should probably be suggested instead of fixed...
      code: makeTest`const typedButNoReturnTypeArrow: (() => Promise<void>) = () => {return Promise.resolve();};`,
      errors: [
        {
          message: "All promise-returning functions must take a parameter of type ClientRequestContext",
          suggestions: [
            {
              desc: "Add a ClientRequestContext parameter",
              output: makeTest`const typedButNoReturnTypeArrow: (() => Promise<void>) = (clientRequestContext: ClientRequestContext) => {return Promise.resolve();};`,
            }
          ]
        }
      ]
    },
    {
      // this should eventually test dont-propagate-request-context settings
      skip: true,
      code: makeTest`
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
