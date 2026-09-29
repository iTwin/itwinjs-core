/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * The extended semantic rebase tests are opt-in because they repeat the core workflows across
 * many schema, data, transaction, and briefcase arrangements.
 */
const semanticRebaseExtendedTestsEnabled = (() => {
  const setting = process.env.ITWIN_INCLUDE_SEMANTIC_REBASE_EXTENDED_TESTS?.trim().toLowerCase();
  return setting === "1" || setting === "true" || setting === "yes";
})();

export const semanticRebaseExtendedDescribe = semanticRebaseExtendedTestsEnabled ? describe : describe.skip;
export const semanticRebaseExtendedIt = semanticRebaseExtendedTestsEnabled ? it : it.skip;
