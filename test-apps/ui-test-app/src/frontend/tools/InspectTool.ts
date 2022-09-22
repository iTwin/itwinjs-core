/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

// cSpell: ignore popout

import { BeButtonEvent, EventHandled, IModelApp, PrimitiveTool } from "@itwin/core-frontend";

import {
  IconSpecUtilities, ToolbarItemUtilities,
} from "@itwin/appui-abstract";
import inspectIconSvg from "@bentley/icons-generic/icons/search.svg";

export class InspectUiItemInfoTool extends PrimitiveTool {
  private _timerId: number | undefined;
  private _currentX = 0;
  private _currentY = 0;
  private _lastElement: HTMLElement | null = null;

  private static _counter = 0;
  public static override toolId = "InspectUiItemInfoTool";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(inspectIconSvg);

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override requireWriteableTarget(): boolean { return false; }

  public static override get flyover(): string {
    return "inspect ui components";
  }
  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return "inspect ui components";
  }

  public static override get englishKeyin(): string {
    return "inspect ui components";
  }

  public processMove() {
    // if little or no motion since last call look for item at location
    const element = document.elementFromPoint(this._currentX, this._currentY);
    if (element && element !== this._lastElement) {
      // eslint-disable-next-line no-console
      console.log(`type = ${element.tagName}`);
      let item = element.querySelector("[data-item-id]") as HTMLElement;
      if (!item)
        item = element.closest("[data-item-id]") as HTMLElement;
      if (item) {
        // eslint-disable-next-line no-console
        console.log(`item = ${item.tagName}`);
        const para = document.createElement("div");
        let out = "";
        const names = ["type", "id", "priority", "location", "group", "provider"];
        ["data-item-type", "data-item-id", "data-item-priority", "data-item-location",
          "data-item-group-priority", "data-item-provider-id"].forEach((value, index) => {
          const attValue = item?.getAttribute(value);
          if (attValue)
            out += `${names[index]}: ${attValue}<br>`;
        });
        para.innerHTML = out;
        IModelApp.notifications.openToolTip(item.ownerDocument.body, para, { x: this._currentX, y: this._currentY });
      }
    }
    this._timerId = undefined;
  }

  private _mouseMove = (ev: MouseEvent) => {
    this._currentX = ev.pageX;
    this._currentY = ev.pageY;

    if (!this._timerId) {  // if there is not a timer active, create one
      this._timerId = window.setTimeout(() => this.processMove(), 100);
    }
  };

  public override async run(..._args: any[]): Promise<boolean> {
    const status = await super.run(_args);
    if (status)
      window.addEventListener("mousemove", this._mouseMove);

    return status;
  }

  public async cleanup() {
    if (this._timerId) {
      window.clearTimeout(this._timerId);
      this._timerId = undefined;
    }
    window.removeEventListener("mousemove", this._mouseMove);

    // eslint-disable-next-line no-console
    console.log("inspect listener removed");
  }

  public override async onCleanup() {
    await super.onCleanup();
    await this.cleanup();
  }

  public override async exitTool() {
    await this.cleanup();
    return IModelApp.toolAdmin.startDefaultTool();
  }

  public async onRestartTool() {
    const tool = new InspectUiItemInfoTool();
    if (!await tool.run())
      return this.exitTool();
  }

  public override async onDataButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    // Used to test Cursor Menu

    this.setupAndPromptForNextAction();

    return EventHandled.No;
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    await this.exitTool();
    return EventHandled.Yes;
  }

  protected setupAndPromptForNextAction(): void {
    IModelApp.notifications.outputPrompt("click over UI item");
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    return ToolbarItemUtilities.createActionButton(InspectUiItemInfoTool.toolId, itemPriority, InspectUiItemInfoTool.iconSpec, InspectUiItemInfoTool.flyover,
      async () => { await IModelApp.tools.run(InspectUiItemInfoTool.toolId); }, overrides);
  }
}
