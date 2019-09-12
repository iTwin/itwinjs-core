/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  HitDetail,
  IModelApp,
  Tool,
  ToolTipProvider,
} from "@bentley/imodeljs-frontend";
import { parseToggle } from "./parseToggle";

/** Augments tooltips with detailed information useful for debugging.
 * @internal
 */
class DebugToolTipProvider implements ToolTipProvider {
  private static _instance?: DebugToolTipProvider;

  public async augmentToolTip(hit: HitDetail, tooltipPromise: Promise<HTMLElement | string>): Promise<HTMLElement | string> {
    // discard and overwrite
    await tooltipPromise;

    const keys: Array<keyof HitDetail> = [ "modelId", "subCategoryId", "tileId" ];
    let html = "";
    for (const key of keys) {
      const value = hit[key];
      if (undefined === value)
        continue;

      html = html + key + ": " + value.toString() + "<br>";
    }

    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
  }

  public static setEnabled(enabled: boolean | undefined): void {
    if (undefined === enabled)
      enabled = undefined === this._instance;

    if (enabled) {
      if (undefined === this._instance) {
        this._instance = new DebugToolTipProvider();
        IModelApp.viewManager.addToolTipProvider(this._instance);
      }
    } else if (undefined !== this._instance) {
      IModelApp.viewManager.dropToolTipProvider(this._instance);
      this._instance = undefined;
    }
  }
}

export class ToggleToolTipsTool extends Tool {
  public static toolId = "ToggleToolTips";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean): boolean {
    DebugToolTipProvider.setEnabled(enable);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}
