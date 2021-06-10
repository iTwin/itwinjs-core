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
          return Promise.resolve().then(() => {
            reqCtx.enter();
          })
        }
      `,
    },
    {
      code: makeTest`
        function goodCatchCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          const promise = Promise.resolve()
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
    {
      code: makeTest`
        async function nonAsyncCatch(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          try {
            const notAsync = 5;
          } catch (_) {
            reqCtx.enter();
            const other = 10;
          }
          return Promise.resolve();
        }
      `,
    },
    {
      code: makeTest`
        async function nestedNonPromiseReturner(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          function recklessNonePromiseReturner() {
            const myPromise = Promise.resolve();
            myPromise.then(() => {
              const validNotEnter = 10;
            }).catch(() => {
              const validNotEnter = 10;
            });
          }
          return Promise.resolve(recklessNonPromiseReturner());
        }
      `,
    },
    {
      only: true,
      code: makeTest`
          async function typeUnion(reqCtx: ClientRequestContext | AuthorizedRequestContext) {
            reqCtx.enter();
            return Promise.resolve(5);
          }
        }
      `,
    },
    {
      only: true,
      code: makeTest`
          async function derivedType(reqCtx: MyReqCtx) {
            reqCtx.enter();
            return Promise.resolve(5);
          }
        }
      `,
    },
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
          messageId: "noEnterOnAwaitResume",
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
          messageId: "noEnterOnFirstLine",
          output: makeTest`
            async function missingFirstEnterCall(reqCtx: ClientRequestContext) {
              reqCtx.enter();await Promise.resolve(5);
              reqCtx.enter();
            }
          `,
        }
      ]
    },
    {
      code: makeTest`async function missingFirstEnterCallEmptyBody(reqCtx: ClientRequestContext) {}`,
      errors: [
        {
          messageId: "noEnterOnFirstLine",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`async function missingFirstEnterCallEmptyBody(reqCtx: ClientRequestContext) {reqCtx.enter();}`,
        }
      ]
    },
    {
      code: makeTest`
        function noEnterAtBeginImplicitAsync(reqCtx: ClientRequestContext) {
          return Promise.resolve(5);
        }
      `,
      errors: [
        {
          messageId: "noEnterOnFirstLine",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function noEnterAtBeginImplicitAsync(reqCtx: ClientRequestContext) {
              reqCtx.enter();return Promise.resolve(5);
            }
          `,
        }
      ]
    },
    {
      code: makeTest`async function f() {}`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`async function f(clientRequestContext: ClientRequestContext) {}`,
        },
      ]
    },
    {
      code: makeTest`async function f(arg1: string) {}`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`async function f(clientRequestContext: ClientRequestContext, arg1: string) {}`,
        },
      ]
    },
    {
      options: [{"context-arg-name": "ctx"}],
      code: makeTest`async function f() {}`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`async function f(ctx: ClientRequestContext) {}`,
        },
      ]
    },
    {
      code: makeTest`async function asyncMethod(otherArg: number) {}`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`async function asyncMethod(clientRequestContext: ClientRequestContext, otherArg: number) {}`,
        }
      ]
    },
    {
      code: makeTest`
        function implicitlyAsync(reqCtx: ClientRequestContext) {
          return Promise.resolve();
        }
      `,
      errors: [
        {
          messageId: "noEnterOnFirstLine",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function implicitlyAsync(reqCtx: ClientRequestContext) {
              reqCtx.enter();return Promise.resolve();
            }
          `,
        }
      ]
    },
    {
      code: makeTest`async function asyncFunc() {}`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`async function asyncFunc(clientRequestContext: ClientRequestContext) {}`,
        }
      ]
    },
    {
      code: makeTest`class C { async asyncMethod() {} }`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`class C { async asyncMethod(clientRequestContext: ClientRequestContext) {} }`,
        }
      ]
    },
    {
      code: makeTest`function promiseReturning(): Promise<void> { return Promise.resolve(); }`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`function promiseReturning(clientRequestContext: ClientRequestContext): Promise<void> { return Promise.resolve(); }`,
        }
      ]
    },
    {
      code: makeTest`function implicitPromiseReturning() { return Promise.resolve(); }`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`function implicitPromiseReturning(clientRequestContext: ClientRequestContext) { return Promise.resolve(); }`,
        }
      ]
    },
    {
      code: makeTest`const asyncArrow = async () => {};`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`const asyncArrow = async (clientRequestContext: ClientRequestContext) => {};`,
        }
      ]
    },
    {
      code: makeTest`const promiseReturningArrow = (): Promise<void> => { return Promise.resolve(); };`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`const promiseReturningArrow = (clientRequestContext: ClientRequestContext): Promise<void> => { return Promise.resolve(); };`,
        }
      ]
    },
    {
      code: makeTest`const implicitPromiseReturningArrow = () => { return Promise.resolve(); };`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`const implicitPromiseReturningArrow = (clientRequestContext: ClientRequestContext) => { return Promise.resolve(); };`,
        }
      ]
    },
    {
      // note that this won't fix the type, that's an error that should probably be suggested instead of fixed...
      code: makeTest`const typedButNoReturnTypeArrow: (() => Promise<void>) = () => {return Promise.resolve();};`,
      errors: [
        {
          messageId: "noCtxParam",
          output: makeTest`const typedButNoReturnTypeArrow: (() => Promise<void>) = (clientRequestContext: ClientRequestContext) => {return Promise.resolve();};`,
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
    },
    {
      code: makeTest`
        function badThenCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve().then(() => {
            const notEnterFirst = 10;
          });
        }
      `,
      errors: [
        {
          messageId: "noEnterOnThenResume",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function badThenCall(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              return Promise.resolve().then(() => {
                reqCtx.enter();const notEnterFirst = 10;
              });
            }
          `,
        }
      ]
    },
    {
      code: makeTest`
        function badComplicatedThenCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve()["then"](() => {
            const notEnterFirst = 10;
          });
        }
      `,
      errors: [
        {
          messageId: "noEnterOnThenResume",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function badComplicatedThenCall(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              return Promise.resolve()["then"](() => {
                reqCtx.enter();const notEnterFirst = 10;
              });
            }
          `,
        }
      ]
    },
    {
      code: makeTest`
        function badCatchCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve().catch(() => {
            const notEnterFirst = 10;
          });
        }
      `,
      errors: [
        {
          messageId: "noEnterOnCatchResume",
          data: { reqCtxArgName: "reqCtx" },
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function badCatchCall(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              return Promise.resolve().catch(() => {
                reqCtx.enter();const notEnterFirst = 10;
              });
            }
          `,
        }
      ]
    },
    {
      code: makeTest`
        function badSecondThenCall(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve().then(() => {
            reqCtx.enter();
            const otherStuff = 5;
          }).then(() => {
            const notEnterFirst = 10;
          });
        }
      `,
      errors: [
        {
          messageId: "noEnterOnThenResume",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function badSecondThenCall(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              return Promise.resolve().then(() => {
                reqCtx.enter();
                const otherStuff = 5;
              }).then(() => {
                reqCtx.enter();const notEnterFirst = 10;
              });
            }
          `,
        }
      ]
    },
    {
      code: makeTest`
        function bathBothThenCalls(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          return Promise.resolve().then(() => {
            const notEnterFirst = 7;
          }).then(() => {
            const notEnterFirst = 10;
          });
        }
      `,
      errors: [
        {
          messageId: "noEnterOnThenResume",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function bathBothThenCalls(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              return Promise.resolve().then(() => {
                reqCtx.enter();const notEnterFirst = 7;
              }).then(() => {
                const notEnterFirst = 10;
              });
            }
          `,
        },
        {
          messageId: "noEnterOnThenResume",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            function bathBothThenCalls(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              return Promise.resolve().then(() => {
                const notEnterFirst = 7;
              }).then(() => {
                reqCtx.enter();const notEnterFirst = 10;
              });
            }
          `,
        }
      ]
    },
    {
      code: makeTest`
        async function badAsyncCatch(reqCtx: ClientRequestContext) {
          reqCtx.enter();
          try {
            await Promise.resolve()
          } catch (ignore) {
            // no immediate context.enter
          }
        }
      `,
      errors: [
        {
          messageId: "noEnterOnCatchResume",
          data: {reqCtxArgName: "reqCtx"},
          output: makeTest`
            async function badAsyncCatch(reqCtx: ClientRequestContext) {
              reqCtx.enter();
              try {
                await Promise.resolve()
              } catch (ignore) {
                // no immediate context.enter
              reqCtx.enter();}
            }
          `,
        }
      ]
    },
  ]
}));
