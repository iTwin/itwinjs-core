/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

import type { AccuSnap } from "../AccuSnap";
import type { ElementLocateManager } from "../ElementLocateManager";
import { IModelApp } from "../IModelApp";
import type { NotificationManager } from "../NotificationManager";
import type { RenderSystem } from "../render/RenderSystem";
import type { ToolAdmin } from "../tools/ToolAdmin";
import type { ViewManager } from "../ViewManager";

/**
 * Subset of IModelApp exposed to Extensions
 * @alpha
 */
export class ExtensionHost {
  protected constructor() {}

  public static get toolAdmin(): ToolAdmin {
    return IModelApp.toolAdmin;
  }
  public static get notifications(): NotificationManager {
    return IModelApp.notifications;
  }
  public static get viewManager(): ViewManager {
    return IModelApp.viewManager;
  }
  public static get locateManager(): ElementLocateManager {
    return IModelApp.locateManager;
  } // internal ?
  public static get accuSnap(): AccuSnap {
    return IModelApp.accuSnap;
  }
  public static get renderSystem(): RenderSystem {
    return IModelApp.renderSystem;
  } // re think this, should be smaller interface
}
