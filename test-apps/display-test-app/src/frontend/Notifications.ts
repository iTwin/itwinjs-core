/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  NotifyMessageDetails,
} from "@bentley/imodeljs-frontend";
import {
  Window,
  WindowProps,
} from "./Window";
import {
  Surface,
} from "./Surface";

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
      if ("string" !== typeof msg)
        return msg;

      const div = document.createElement("div");
      div.innerText = msg;
      return div;
    };

    const msgDiv = document.createElement("div");
    msgDiv.appendChild(toHtml(message.briefMessage));
    if (undefined !== message.detailedMessage)
      msgDiv.appendChild(toHtml(message.detailedMessage));

    msgDiv.appendChild(document.createElement("hr"));
    this.contentDiv.appendChild(msgDiv);

    while (this.contentDiv.childElementCount > this._maxMessages)
      this.contentDiv.removeChild(this.contentDiv.firstChild!);

    this.contentDiv.scrollTop = this.contentDiv.scrollHeight;
  }
}
