/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

"use strict";

/** @param {string[]} strings */
module.exports = {
  /**
   * Remove indentation included in multiline template literal strings. Expects
   * a new line immediately at the start of the string,
   *
   * This is a template literal function, so used like:
   * ```
   * const text = dedent`
   *   text
   * `;
   * ```
   *
   * @param {string[]} strings
   */
  dedent(strings) {
    const textAssumingNoInterpolations = strings[0];
    const codeLines = textAssumingNoInterpolations.split("\n");
    if (codeLines.length <= 1) return textAssumingNoInterpolations;
    const leftPadding = codeLines[1].match(/[\t ]+/)?.[0];
    if (leftPadding)
      return codeLines
        .slice(1, -1)
        .map((l) => l.substr(leftPadding.length))
        .join("\n");
  },

  /** allow specifying `only` and `skip` properties for easier debugging */
  supportSkippedAndOnlyInTests(obj) {
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
  },
};
