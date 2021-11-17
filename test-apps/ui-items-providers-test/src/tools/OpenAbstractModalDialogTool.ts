/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { IModelApp, Tool } from "@itwin/core-frontend";
import { TestUiProvider } from "../ui/dialogs/TestUiProviderDialog";
import { ToolbarItemUtilities } from "@itwin/appui-abstract";
import { UiItemsProvidersTest } from "../ui-items-providers-test";

/**
 * Immediate tool that will open an example modal dialog.The tool is created and register to allow the user
 * to activate the tool via the key-in palette using the tools keyin property (which must be unique across
 * all registered tools).
 * @alpha
 */
export class OpenAbstractDialogTool extends Tool {
  public static override toolId = "uiItemsProvidersTest-OpenAbstractModalDialogTool";
  public static override iconSpec = "icon-lightbulb-2";

  // istanbul ignore next
  public static override get minArgs() { return 0; }
  // istanbul ignore next
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    IModelApp.uiAdmin.openDialog(new TestUiProvider(), "Test Abstract Dialog", true, "ui-item-provider-test:AbstractDialog", {
      movable: true,
      width: "auto",
    });
    return true;
  }

  public static override get flyover(): string {
    return UiItemsProvidersTest.translate("tools.open-abstract-dialog");
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return this.englishKeyin;
  }

  public static override get englishKeyin(): string {
    return "open abstract dialog";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {

    const overrides = {
      groupPriority,
    };

    return ToolbarItemUtilities.createActionButton(OpenAbstractDialogTool.toolId, itemPriority, OpenAbstractDialogTool.iconSpec, OpenAbstractDialogTool.flyover,
      async () => { await IModelApp.tools.run(OpenAbstractDialogTool.toolId); },
      overrides);
  }
}
