/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * Executes an extension's bundled javascript module.
 * First attempts an ES6 dynamic import,
 * second attempts a dynamic import via a script element as a fallback.
 * Used by remote and service Extensions.
 * Throws an error if the module does not have a default or main function to execute.
 * @internal
 */
export async function loadScript(jsUrl: string): Promise<any> {
  // Warning "Critical dependency: the request of a dependency is an expression"
  // until that is resolved, leave code commented:
  // const module = await import(/* webpackIgnore: true */jsUrl);
  // return execute(module);
  return new Promise((resolve, reject) => {
    const head = document.getElementsByTagName("head")[0];
    if (!head)
      reject(new Error("No head element found"));

    const scriptElement = document.createElement("script");
    const tempGlobal: string = `__tempModuleLoadingVariable${Math.random().toString(32).substring(2)}`;

    function cleanup() {
      delete (window as any)[tempGlobal];
      scriptElement.remove();
    }

    (window as any)[tempGlobal] = async function (module: any) {
      await execute(module);
      cleanup();
      resolve(module);
    };
    scriptElement.type = "module";
    scriptElement.textContent = `import * as m from "${jsUrl}";window.${tempGlobal}(m);`;

    scriptElement.onerror = () => {
      reject(new Error(`Failed to load extension with URL ${jsUrl}`));
      cleanup();
    };

    head.insertBefore(scriptElement, head.lastChild);
  });
}

function execute(m: any) {
  if (typeof m === "function")
    return m();
  if (m.main && typeof m.main === "function")
    return m.main();
  if (m.default && typeof m.default === "function")
    return m.default();
  throw new Error(`Failed to load extension. No default function was found to execute.`);
}
