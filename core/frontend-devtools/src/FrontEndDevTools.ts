/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@bentley/imodeljs-frontend";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool";
import {
  LoseWebGLContextTool,
  ToggleReadPixelsTool,
  ToggleLogZTool,
} from "./tools/RenderTargetTools";
import {
  ClearIsolatedElementsTool,
  EmphasizeSelectedElementsTool,
  IsolateSelectedElementsTool,
} from "./tools/EmphasizeElementsTool";
import { ChangeViewFlagsTool } from "./tools/ChangeViewFlagsTool";

/** Entry-point for the package. Before using the package you *must* call [[FrontendDevTools.initialize]].
 * @beta
 */
export class FrontendDevTools {
  private static _initialized = false;

  /** Call this before using the package (e.g., before instantiating any of its widgets or attempting to use any of its tools.
   * To initialize when starting up your app:
   * ```ts
   *   IModelApp.startup();
   *   await FrontendDevTools.initialize();
   * ```
   * @beta
   */
  public static async initialize(): Promise<void> {
    if (this._initialized)
      return Promise.resolve();

    this._initialized = true;

    const i18n = IModelApp.i18n.registerNamespace("FrontendDevTools");

    ReportWebGLCompatibilityTool.register(i18n);
    LoseWebGLContextTool.register(i18n);
    ToggleReadPixelsTool.register(i18n);
    ToggleLogZTool.register(i18n);

    ClearIsolatedElementsTool.register(i18n);
    EmphasizeSelectedElementsTool.register(i18n);
    IsolateSelectedElementsTool.register(i18n);

    ChangeViewFlagsTool.register(i18n);

    return i18n.readFinished;
  }
}
