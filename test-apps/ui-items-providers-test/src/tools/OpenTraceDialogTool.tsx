/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import * as React from "react";
import { IModelApp, Tool } from "@itwin/core-frontend";
import { UiFramework } from "@itwin/appui-react";
import { SampleModalDialog } from "../ui/dialogs/SampleModalDialog";
import { IconSpecUtilities, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { UiItemsProvidersTest } from "../ui-items-providers-test";
import connectedQuerySvg from "../ui/icons/connected-query.svg";

/**
 * Immediate tool that will open an example modal dialog.The tool is created and register to allow the user
 * to activate the tool via the key-in palette using the tools keyin property (which must be unique across
 * all registered tools).
 */
export class OpenTraceDialogTool extends Tool {
  public static override toolId = "uiItemsProvidersTest-OpenTraceDialogTool";
  public static override iconSpec = connectedQuerySvg;

  // istanbul ignore next
  public static override get minArgs() { return 0; }
  // istanbul ignore next
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    UiFramework.dialogs.modal.openDialog(<SampleModalDialog />);
    return true;
  }

  public static override get flyover(): string {
    return UiItemsProvidersTest.translate("trace-tool-connected");
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return this.englishKeyin;
  }

  public static override get englishKeyin(): string {
    return "trace tool connected";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    const iconSpec = IconSpecUtilities.createWebComponentIconSpec(`${this.iconSpec}`);
    return ToolbarItemUtilities.createActionButton(OpenTraceDialogTool.toolId, itemPriority, iconSpec, OpenTraceDialogTool.flyover,
      async () => { await IModelApp.tools.run(OpenTraceDialogTool.toolId); },
      overrides);
  }
}
