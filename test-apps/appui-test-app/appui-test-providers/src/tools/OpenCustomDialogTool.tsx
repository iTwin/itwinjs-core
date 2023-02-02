/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import * as React from "react";
import { IModelApp, Tool } from "@itwin/core-frontend";
import { SampleModalDialog } from "../ui/dialogs/SampleModalDialog";
import { ConditionalBooleanValue, IconSpecUtilities, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { AppUiTestProviders } from "../AppUiTestProviders";
import connectedQuerySvg from "../ui/icons/connected-query.svg";
import { UiFramework } from "@itwin/appui-react";

/**
 * Immediate tool that will open an example modal dialog.The tool is created and register to allow the user
 * to activate the tool via the key-in palette using the tools keyin property (which must be unique across
 * all registered tools).
 */
export class OpenCustomDialogTool extends Tool {
  public static override toolId = "appuiTestProviders-OpenCustomDialogTool";
  public static override iconSpec = connectedQuerySvg;

  // istanbul ignore next
  public static override get minArgs() { return 0; }
  // istanbul ignore next
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    UiFramework.dialogs.modal.open(<SampleModalDialog />);
    return true;
  }

  public static override get flyover(): string {
    return AppUiTestProviders.translate("tools.open-custom-dialog-tool");
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return this.englishKeyin;
  }

  public static override get englishKeyin(): string {
    return "open custom dialog";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number, isHidden?: ConditionalBooleanValue) {
    const overrides = {
      groupPriority,
      isHidden,
    };
    const iconSpec = IconSpecUtilities.createWebComponentIconSpec(`${this.iconSpec}`);
    return ToolbarItemUtilities.createActionButton(OpenCustomDialogTool.toolId, itemPriority, iconSpec, OpenCustomDialogTool.flyover,
      async () => { await IModelApp.tools.run(OpenCustomDialogTool.toolId); },
      overrides);
  }
}
