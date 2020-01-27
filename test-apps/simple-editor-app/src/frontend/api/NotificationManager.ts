/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { NotificationManager, NotifyMessageDetails, MessageBoxType, MessageBoxIconType, MessageBoxValue, OutputMessagePriority, IModelApp } from "@bentley/imodeljs-frontend";
import { BeEvent } from "@bentley/bentleyjs-core";

export interface LatestNotifications {
  prompt: string;
  message: NotifyMessageDetails;
}

export const emptyNotification = new NotifyMessageDetails(OutputMessagePriority.None, "");

export class Notifications extends NotificationManager {
  public onChange = new BeEvent<(_latest: LatestNotifications) => void> ();
  public latest: LatestNotifications = { prompt: "", message: emptyNotification };

  public outputPrompt(prompt: string) {
    const latest = {...this.latest, prompt };
    this.latest = latest;
    this.onChange.raiseEvent(this.latest);
  }

  public outputMessage(message: NotifyMessageDetails) {
    const latest = {...this.latest, message };
    this.latest = latest;
    this.onChange.raiseEvent(this.latest);
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

  public get isToolTipSupported() { return false; }
  public get isToolTipOpen() { return false; }
}
