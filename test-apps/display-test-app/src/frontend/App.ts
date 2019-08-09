/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { XAndY } from "@bentley/geometry-core";
import {
  AccuSnap,
  IModelApp,
  IModelAppOptions,
  MessageBoxIconType,
  MessageBoxType,
  MessageBoxValue,
  NotificationManager,
  NotifyMessageDetails,
  SelectionTool,
  SnapMode,
  TileAdmin,
  ToolTipOptions,
} from "@bentley/imodeljs-frontend";
import { FrontendDevTools } from "@bentley/frontend-devtools";
import ToolTip from "tooltip.js";
import { DrawingAidTestTool } from "./DrawingAidTestTool";
import { showError, showStatus } from "./Utils";
import { MarkupSelectTestTool } from "./MarkupSelectTestTool";

class DisplayTestAppAccuSnap extends AccuSnap {
  private readonly _activeSnaps: SnapMode[] = [SnapMode.NearestKeypoint];

  public get keypointDivisor() { return 2; }
  public getActiveSnapModes(): SnapMode[] { return this._activeSnaps; }
  public setActiveSnapModes(snaps: SnapMode[]): void {
    this._activeSnaps.length = snaps.length;
    for (let i = 0; i < snaps.length; i++)
      this._activeSnaps[i] = snaps[i];
  }
}

class Notifications extends NotificationManager {
  private _toolTip?: ToolTip;
  private _el?: HTMLElement;
  private _tooltipDiv?: HTMLDivElement;

  public outputPrompt(prompt: string) { showStatus(prompt); }

  /** Output a message and/or alert to the user. */
  public outputMessage(message: NotifyMessageDetails) { showError(message.briefMessage); }

  public async openMessageBox(_mbType: MessageBoxType, message: HTMLElement | string, _icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const rootDiv = document.getElementById("root") as HTMLDivElement;
    if (!rootDiv)
      return MessageBoxValue.Cancel;

    // create a dialog element.
    const dialog = document.createElement("dialog") as HTMLDialogElement;
    dialog.className = "notification-messagebox";

    // set up the message
    const span = document.createElement("span");
    if (typeof message === "string")
      span.innerHTML = message;
    else
      span.appendChild(message);
    span.className = "notification-messageboxtext";
    dialog.appendChild(span);

    // make the ok button
    const button = document.createElement("button");
    button.className = "notification-messageboxbutton";
    button.innerHTML = "Ok";
    dialog.appendChild(button);

    const promise = new Promise<MessageBoxValue>((resolve, _rej) => {
      button.addEventListener("click", () => {
        dialog.close();
        rootDiv.removeChild(dialog);
        resolve(MessageBoxValue.Ok);
      });
    });

    // add the dialog to the root div element and show it.
    rootDiv.appendChild(dialog);
    dialog.showModal();
    return promise;
  }

  public get isToolTipSupported() { return true; }
  public get isToolTipOpen() { return undefined !== this._toolTip; }

  public clearToolTip(): void {
    if (!this.isToolTipOpen)
      return;

    this._toolTip!.dispose();
    this._el!.removeChild(this._tooltipDiv!);
    this._toolTip = undefined;
    this._el = undefined;
    this._tooltipDiv = undefined;
  }

  protected _showToolTip(el: HTMLElement, message: HTMLElement | string, pt?: XAndY, options?: ToolTipOptions): void {
    this.clearToolTip();

    if (undefined === pt) {
      const rect = el.getBoundingClientRect();
      pt = { x: rect.width / 2, y: rect.height / 2 };
    }

    const location = document.createElement("div");
    const height = 20;
    const width = 20;
    location.style.position = "absolute";
    location.style.top = (pt.y - height / 2) + "px";
    location.style.left = (pt.x - width / 2) + "px";
    location.style.width = width + "px";
    location.style.height = height + "px";

    el.appendChild(location);

    this._el = el;
    this._tooltipDiv = location;
    this._toolTip = new ToolTip(location, { trigger: "manual", html: true, placement: (options && options.placement) ? options.placement as any : "right-start", title: message });
    this._toolTip!.show();
  }
}

class SVTSelectionTool extends SelectionTool {
  public static toolId = "SVTSelect";
  protected initSelectTool() {
    super.initSelectTool();

    // ###TODO Want to do this only if version comparison enabled, but meh.
    IModelApp.locateManager.options.allowExternalIModels = true;
  }
}

export class DisplayTestApp {
  public static tileAdminProps: TileAdmin.Props = {
    retryInterval: 50,
    enableInstancing: true,
  };

  public static async startup(opts?: IModelAppOptions): Promise<void> {
    opts = opts ? opts : {};
    opts.accuSnap = new DisplayTestAppAccuSnap();
    opts.notifications = new Notifications();
    opts.tileAdmin = TileAdmin.create(DisplayTestApp.tileAdminProps);
    IModelApp.startup(opts);

    const svtToolNamespace = IModelApp.i18n.registerNamespace("SVTTools");
    DrawingAidTestTool.register(svtToolNamespace);
    MarkupSelectTestTool.register(svtToolNamespace);
    SVTSelectionTool.register(svtToolNamespace);

    IModelApp.toolAdmin.defaultToolId = SVTSelectionTool.toolId;

    return FrontendDevTools.initialize();
  }

  public static setActiveSnapModes(snaps: SnapMode[]): void {
    (IModelApp.accuSnap as DisplayTestAppAccuSnap).setActiveSnapModes(snaps);
  }

  public static setActiveSnapMode(snap: SnapMode): void { this.setActiveSnapModes([snap]); }
}
