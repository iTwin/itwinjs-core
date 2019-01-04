/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Tool } from "./Tool";

async function loadPackage(packageName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const head = document.getElementsByTagName("head")[0];
    if (!head)
      reject(new Error("no head element found"));

    // create the script element. handle onload and onerror.
    const scriptElement = document.createElement("script");
    scriptElement.onload = () => {
      scriptElement.onload = null;
      resolve();
    };
    scriptElement.onerror = (ev) => {
      scriptElement.onload = null;
      reject(new Error("can't load " + packageName + " : " + ev));
    };
    scriptElement.async = true;
    scriptElement.src = packageName;
    head.insertBefore(scriptElement, head.lastChild);
  });
}

/**
 * An Immediate Tool that allows an iModelJs plugin module to be loaded .
 */
export class PluginTool extends Tool {
  public static toolId = "Plugin";
  public run(args: any[]): boolean {
    // we can only use $script in a browser environment.
    if (!typeof document) {
      // tslint:disable:no-console
      console.log("PluginTool is only available in browser environment");
      return false;
    }

    // tslint:disable:no-console
    console.log(args);
    if (args && args.length > 0 && args[0]) {
      // tslint:disable-line:no-console
      loadPackage(args[0]).then(() => { console.log("script", args[0], "loaded"); }).catch((_err) => { console.log("Unable to load plugin"); });
    }
    return true;
  }
}
