/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const ESLintTester = require('eslint').RuleTester;
const BentleyESLintPlugin = require('../dist');
const ClientRequestContextESLintRule = BentleyESLintPlugin.rules["client-request-context"];

// copied from eslint-plugin-react-hooks's tests
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

const goodMethod = `class Good {
  async goodMethod(reqCtx: ClientRequestContext) {
    reqCtx.enter();
    await Promise.resolve(5);
    reqCtx.enter();
  }
}
`

const badMethod = normalizeIndex`
class Bad {
  async badMethod(reqCtx: ClientRequestContext) {
    reqCtx.enter();
    await Promise.resolve(5);
    const badStatement = 10;
  }
}
`;