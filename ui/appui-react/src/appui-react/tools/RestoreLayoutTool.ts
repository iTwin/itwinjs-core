/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool } from "@itwin/core-frontend";
import { FrontstageDef } from "../frontstage/FrontstageDef";
import { InternalFrontstageManager } from "../frontstage/InternalFrontstageManager";
import { UiFramework } from "../UiFramework";

/**
 * Immediate tool that will reset the layout to that specified in the stage definition. A stage Id
 * may be passed in, if not the active stage is used. The stage Id is case sensitive.
 * @alpha
 */
export class RestoreFrontstageLayoutTool extends Tool {
  public static override toolId = "RestoreFrontstageLayout";
  public static override iconSpec = "icon-view-layouts";

  // istanbul ignore next
  public static override get minArgs() { return 0; }
  // istanbul ignore next
  public static override get maxArgs() { return 1; }

  public override async run(frontstageId?: string): Promise<boolean> {
    let frontstageDef: FrontstageDef | undefined;

    if (frontstageId) {
      frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageId);
    } else {
      frontstageDef = UiFramework.frontstages.activeFrontstageDef;
    }

    if (frontstageDef)
      frontstageDef.restoreLayout();
    else
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, UiFramework.translate("tools.RestoreFrontstageLayout.noStageFound")));
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}

/**
 * Immediate tool that will reset the layout of all frontstages to that specified in the stage definition.
 * @alpha
 */
export class RestoreAllFrontstagesTool extends Tool {
  public static override toolId = "RestoreAllFrontstages";
  public static override iconSpec = "icon-view-layouts";

  public override async run() {
    const frontstages = InternalFrontstageManager.frontstageDefs;
    for (const [, frontstage] of frontstages) {
      frontstage.restoreLayout();
    }
    return true;
  }
}
