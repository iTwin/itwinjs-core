/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { XAndY } from "@bentley/geometry-core";
import {
  IModelApp, MessageBoxIconType, MessageBoxType, MessageBoxValue, NotificationManager, NotifyMessageDetails, ToolTipOptions,
} from "@bentley/imodeljs-frontend";
import ToolTip from "tooltip.js";
import { showError, showStatus } from "./Utils";
import { Surface } from "./Surface";
import { Window, WindowProps } from "./Window";

export interface NotificationsWindowProps extends WindowProps {
  maxStoredMessages: number;
}

export class NotificationsWindow extends Window {
  private readonly _maxMessages: number;

  public get isCloseable() { return false; }
  public get windowId() { return "notifications"; }

  public constructor(surface: Surface, props: NotificationsWindowProps) {
    super(surface, props);
    this._maxMessages = props.maxStoredMessages;
    this.contentDiv.id = "notifications-window";
    surface.element.appendChild(this.container);
  }

  public addMessage(message: NotifyMessageDetails): void {
    const toHtml = (msg: HTMLElement | string) => {
      return ("string" !== typeof msg) ? msg : IModelApp.makeHTMLElement("div", { innerText: msg });
    };

    const msgDiv = IModelApp.makeHTMLElement("div", { parent: this.contentDiv });
    msgDiv.appendChild(toHtml(message.briefMessage));
    if (undefined !== message.detailedMessage)
      msgDiv.appendChild(toHtml(message.detailedMessage));

    IModelApp.makeHTMLElement("hr", { parent: msgDiv });

    while (this.contentDiv.childElementCount > this._maxMessages)
      this.contentDiv.removeChild(this.contentDiv.firstChild!);

    this.contentDiv.scrollTop = this.contentDiv.scrollHeight;
  }
}

export class Notifications extends NotificationManager {
  private _toolTip?: ToolTip;
  private _el?: HTMLElement;
  private _tooltipDiv?: HTMLDivElement;

  public outputPrompt(prompt: string) { showStatus(prompt); }

  /** Output a message and/or alert to the user. */
  public outputMessage(message: NotifyMessageDetails) {
    showError(message.briefMessage);
    Surface.instance.notifications.addMessage(message);
  }

  public async openMessageBox(_mbType: MessageBoxType, message: HTMLElement | string, _icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const rootDiv = document.getElementById("root") as HTMLDivElement;
    if (!rootDiv)
      return MessageBoxValue.Cancel;

    // create a dialog element.
    const dialog = IModelApp.makeHTMLElement("dialog", { parent: rootDiv, className: "notification-messagebox" });

    // set up the message
    const span = IModelApp.makeHTMLElement("span", { parent: dialog, className: "notification-messageboxtext" });
    if (typeof message === "string")
      span.innerHTML = message;
    else
      span.appendChild(message);

    // make the ok button
    const button = IModelApp.makeHTMLElement("button", { parent: dialog, className: "notification-messageboxbutton" });
    button.innerHTML = "Ok";

    const promise = new Promise<MessageBoxValue>((resolve, _rej) => {
      button.addEventListener("click", () => {
        dialog.close();
        rootDiv.removeChild(dialog);
        resolve(MessageBoxValue.Ok);
      });
    });

    // add the dialog to the root div element and show it.
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

    const location = IModelApp.makeHTMLElement("div", { parent: el });
    const height = 20;
    const width = 20;
    location.style.position = "absolute";
    location.style.top = (pt.y - height / 2) + "px";
    location.style.left = (pt.x - width / 2) + "px";
    location.style.width = width + "px";
    location.style.height = height + "px";

    this._el = el;
    this._tooltipDiv = location;
    this._toolTip = new ToolTip(location, { trigger: "manual", html: true, placement: (options && options.placement) ? options.placement as any : "right-start", title: message });
    this._toolTip!.show();
  }
}
