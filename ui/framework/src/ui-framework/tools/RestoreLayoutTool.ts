/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool } from "@bentley/imodeljs-frontend";
import { FrontstageManager } from "../frontstage/FrontstageManager.js";
import { FrontstageDef } from "../frontstage/FrontstageDef.js";
import { UiFramework } from "../UiFramework.js";

/**
 * Immediate tool that will reset the layout to that specified in the stage definition. A stage Id
 * may be passed in, if not the active stage is used. The stage Id is case sensitive.
 * @alpha
 */
export class RestoreFrontstageLayoutTool extends Tool {
  public static toolId = "RestoreFrontstageLayout";
  public static iconSpec = "icon-view-layouts";

  // istanbul ignore next
  public static get minArgs() { return 0; }
  // istanbul ignore next
  public static get maxArgs() { return 1; }

  public run(frontstageId?: string): boolean {
    let frontstageDef: FrontstageDef | undefined;

    if (frontstageId) {
      frontstageDef = FrontstageManager.findFrontstageDef(frontstageId);
    } else {
      frontstageDef = FrontstageManager.activeFrontstageDef;
    }

    if (frontstageDef)
      frontstageDef.restoreLayout();
    else
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, UiFramework.translate("tools.RestoreFrontstageLayout.noStageFound")));
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}
