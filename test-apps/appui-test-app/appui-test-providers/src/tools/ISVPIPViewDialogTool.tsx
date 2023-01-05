/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IconSpecUtilities, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { ContentDialog, ContentDialogManager, FrontstageManager } from "@itwin/appui-react";
import { IModelApp, Tool } from "@itwin/core-frontend";
import * as React from "react";
import { ISVPIPView } from "../ui/dialogs/ISVPIPView";
import panoramaconSvg from "@bentley/icons-generic/icons/panorama.svg";

export class ISVPIPViewDialogTool extends Tool {
  private static _counter = 0;
  public static override toolId = "OpenViewDialog";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(panoramaconSvg);
  public static get dialogId(): string {
    return `ui-test-app:popup-view-dialog-${ISVPIPViewDialogTool._counter}`;
  }

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    await this._run();
    return true;
  }

  private async _run(): Promise<void> {
    ISVPIPViewDialogTool._counter = ISVPIPViewDialogTool._counter + 1;
    let x: number | undefined;
    let y: number | undefined;
    const stage = FrontstageManager.activeFrontstageDef;
    if (stage && stage.nineZoneState) {
      const floatingContentCount = stage.floatingContentControls?.length ?? 0;
      // we should not really every support more than 8 floating views
      if (floatingContentCount < 1 && stage.nineZoneState.size.width > 800 && stage.nineZoneState.size.height > 600) {
        x = (.3 * stage.nineZoneState.size.width) + (40 * (floatingContentCount - 1));
        y = (.3 * stage.nineZoneState.size.height) + (40 * (floatingContentCount - 1));
      }
    }
    ContentDialogManager.openDialog(<IModelViewDialog x={x} y={y} id={ISVPIPViewDialogTool.dialogId}
      title={`IModel View (${ISVPIPViewDialogTool._counter})`} />, ISVPIPViewDialogTool.dialogId);
  }

  public static override get flyover(): string {
    return "open view dialog";
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return "open view dialog";
  }

  public static override get englishKeyin(): string {
    return "open view dialog";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    return ToolbarItemUtilities.createActionButton(ISVPIPViewDialogTool.toolId, itemPriority, ISVPIPViewDialogTool.iconSpec, ISVPIPViewDialogTool.flyover,
      async () => { await IModelApp.tools.run(ISVPIPViewDialogTool.toolId); }, overrides);
  }
}

export function IModelViewDialog({ x, y, id, title }: { x?: number, y?: number, id: string, title: string }) {
  const handleClose = React.useCallback(() => {
    ContentDialogManager.closeDialog(id);
  }, [id]);

  return (
    <ContentDialog
      title={title}
      inset={false}
      opened={true}
      onClose={handleClose}
      onEscape={handleClose}
      width={"40vw"}
      height={"40vh"}
      dialogId={id}
      x={x}
      y={y}
    >
      <ISVPIPView contentId={id} showViewPicker= {false}/>
    </ContentDialog>
  );
}
