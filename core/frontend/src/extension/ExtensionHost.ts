import { IModelApp } from "../IModelApp";
import type { ToolAdmin } from "../tools/ToolAdmin";
import type { AccuSnap } from "../AccuSnap";
import type { NotificationManager } from "../NotificationManager";
import type { ViewManager } from "../ViewManager";
import type { ElementLocateManager } from "../ElementLocateManager";
import type { Localization } from "@itwin/core-common";

/**
 * Subset of IModelApp exposed to Extensions
 * @beta
 */
export class ExtensionHost {
  protected constructor() { }

  public static get toolAdmin(): ToolAdmin { return IModelApp.toolAdmin; }
  public static get notifications(): NotificationManager { return IModelApp.notifications; }
  public static get viewManager(): ViewManager { return IModelApp.viewManager; }
  public static get locateManager(): ElementLocateManager { return IModelApp.locateManager; } // internal ?
  public static get accuSnap(): AccuSnap { return IModelApp.accuSnap; }
  public static get localization(): Localization { return IModelApp.localization; }
}
