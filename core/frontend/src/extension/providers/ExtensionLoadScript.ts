/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Imports and executes a bundled javascript (esm) module.
 * Used by remote and service Extensions.
 * Throws an error if no function is found to execute.
 * Looks for a function in the following order:
 * - the module itself.
 * - the module's main export.
 * - the module's default export.
 * @internal
 */
export async function loadScript(jsUrl: string): Promise<any> {
  // const module = await import(/* webpackIgnore: true */jsUrl);
  // Webpack gives a warning:
  // "Critical dependency: the request of a dependency is an expression"
  // Because tsc transpiles "await import" to "require" (when compiled to is CommonJS).
  // So use FunctionConstructor to avoid tsc.
  const module = await Function("x","return import(x)")(jsUrl);
  return execute(module);
}

/** attempts to execute an extension module */
function execute(m: any) {
  if (typeof m === "function")
    return m();
  if (m.main && typeof m.main === "function")
    return m.main();
  if (m.default && typeof m.default === "function")
    return m.default();
  throw new Error(
    `Failed to execute extension. No default function was found to execute.`,
  );
}
