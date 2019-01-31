/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { XAndY } from "@bentley/geometry-core";
import {
  AccuSnap, IModelApp, MessageBoxIconType, MessageBoxType, MessageBoxValue, NotificationManager, NotifyMessageDetails,
  SnapMode, ToolTipOptions,
} from "@bentley/imodeljs-frontend";
import ToolTip from "tooltip.js";
import { DrawingAidTestTool } from "./DrawingAidTestTool";
import { showError, showStatus } from "./Utils";

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

  public async openMessageBox(_mbType: MessageBoxType, _message: string, _icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const rootDiv: HTMLDivElement = document.getElementById("root") as HTMLDivElement;
    if (!rootDiv)
      return Promise.resolve(MessageBoxValue.Cancel);

    // create a dialog element.
    const dialog: HTMLDialogElement = document.createElement("dialog") as HTMLDialogElement;
    dialog.className = "notification-messagebox";

    // set up the message
    const span: HTMLSpanElement = document.createElement("span");
    span.innerHTML = _message;
    span.className = "notification-messageboxtext";
    dialog.appendChild(span);

    // make the ok button.
    const button: HTMLButtonElement = document.createElement("button");
    button.className = "notification-messageboxbutton";
    button.innerHTML = "Ok";
    button.onclick = (event) => {
      const okButton = event.target as HTMLButtonElement;
      const msgDialog = okButton.parentElement as HTMLDialogElement;
      const topDiv = msgDialog.parentElement as HTMLDivElement;
      msgDialog.close();
      topDiv.removeChild(dialog);
    };
    dialog.appendChild(button);

    // add the dialog to the root div element and show it.
    rootDiv.appendChild(dialog);
    dialog.showModal();

    return Promise.resolve(MessageBoxValue.Ok);
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

export class DisplayTestApp extends IModelApp {
  protected static onStartup(): void {
    IModelApp.accuSnap = new DisplayTestAppAccuSnap();
    IModelApp.notifications = new Notifications();
    const svtToolNamespace = IModelApp.i18n.registerNamespace("SVTTools");
    DrawingAidTestTool.register(svtToolNamespace);
  }

  public static setActiveSnapModes(snaps: SnapMode[]): void {
    (IModelApp.accuSnap as DisplayTestAppAccuSnap).setActiveSnapModes(snaps);
  }

  public static setActiveSnapMode(snap: SnapMode): void { this.setActiveSnapModes([snap]); }
}
