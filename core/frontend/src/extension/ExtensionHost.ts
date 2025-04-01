/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import { IModelApp } from "../IModelApp.js";
import type { ToolAdmin } from "../tools/ToolAdmin.js";
import type { AccuSnap } from "../AccuSnap.js";
import type { NotificationManager } from "../NotificationManager.js";
import type { ViewManager } from "../ViewManager.js";
import type { ElementLocateManager } from "../ElementLocateManager.js";
import type { RenderSystem } from "../render/RenderSystem.js";

/**
 * Subset of IModelApp exposed to Extensions
 * @alpha
 */
export class ExtensionHost {
  protected constructor() { }

  public static get toolAdmin(): ToolAdmin { return IModelApp.toolAdmin; }
  public static get notifications(): NotificationManager { return IModelApp.notifications; }
  public static get viewManager(): ViewManager { return IModelApp.viewManager; }
  public static get locateManager(): ElementLocateManager { return IModelApp.locateManager; } // internal ?
  public static get accuSnap(): AccuSnap { return IModelApp.accuSnap; }
  public static get renderSystem(): RenderSystem { return IModelApp.renderSystem; } // re think this, should be smaller interface
}
