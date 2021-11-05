/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

const assertionsEnabled = process.env.NODE_ENV === "development";

/** Asserts that a condition is `true` and - when enabled - throws an error if it is not.
 * Assertions are enabled only if the build configuration defines `process.env.NODE_ENV` as `development` at build time.
 *
 * Assertions exist solely to assist programmers during development, in the following ways:
 *  1 They allow the programmer to declare conditions that they believe cannot possibly occur. If such conditions occur, they indicate
 *    a serious flaw in the programmer's logic.
 *  2 They allow the programmer to assure the TypeScript compiler of the truth of some condition that the compiler cannot itself infer.
 *  3 They allow the author of an API to indicate to consumers of the API a serious misuse that should be corrected during development.
 *
 * Assertions should **never** be used to test for conditions - however unlikely - that could be expected to occur at run-time,
 * such as failing to write to a file or load a resource over the network. If the condition asserted ever fails in a production environment,
 * the programmer has made a serious mistake.
 *
 * Note that even when assertions are disabled, calls to `assert` remain in the code and their arguments will be evaluated at run-time.
 * Therefore, if your condition or message requires computation, prefer to pass it as a function to prevent it from being evaluated when assertions are disabled.
 *
 * @param condition The condition that is asserted to be `true`. If the condition is more complex than a simple `boolean` variable, pass it as a function to prevent it from being evaluated when assertions are disabled.
 * @param message An optional description of the condition being asserted, to be included in the exception if `condition` is `false`. If the message must be computed, pass it as a function to prevent it from being evaluated when assertions are disabled. Defaults to "Programmer Error".
 * @throws Error containing the specified `message` if `condition` is `false`.
 * @public
 */
export function assert(condition: boolean | (() => boolean), message?: string | (() => string)): asserts condition {
  if (!assertionsEnabled)
    return;

  if ("boolean" !== typeof condition)
    condition = condition();

  if (condition)
    return;

  message = message ?? "Programmer Error";
  if ("string" !== typeof message)
    message = message();

  throw new Error(`Assert: ${message}`);
}
