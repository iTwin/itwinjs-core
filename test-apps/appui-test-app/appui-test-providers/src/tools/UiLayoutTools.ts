/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UiFramework, WidgetState } from "@itwin/appui-react";
import { Tool } from "@itwin/core-frontend";

/** Tool that will set widget state of a widget. I.e. `widget setstate w1 2` where w1 is widget id and 2 is WidgetState. */
export class SetWidgetStateTool extends Tool {
  public static override toolId = "SetWidgetStateTool";
  public static override get minArgs() { return 2; }
  public static override get maxArgs() { return 2; }
  public static override get keyin() {
    return "widget setstate";
  }

  public override async run(widgetId: string, widgetState: WidgetState) {
    const frontstage = UiFramework.frontstages.activeFrontstageDef;
    if (!frontstage)
      return false;
    const widget = frontstage.findWidgetDef(widgetId);
    if (!widget)
      return false;

    widget.setWidgetState(widgetState);
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const widgetState = Number(args[1]);
    return this.run(args[0], widgetState);
  }
}
