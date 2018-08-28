/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";
import {
  NotifyMessageDetails,
  OutputMessagePriority,
  MessageBoxType,
  MessageBoxIconType,
  MessageBoxValue,
} from "@bentley/imodeljs-frontend";

import { UiEvent } from "@bentley/ui-core";
import { MessageSeverity } from "@bentley/ui-core";
import { ModalDialogManager } from "./ModalDialogManager";
import UiFramework from "../UiFramework";
import { StandardMessageBox } from "./StandardMessageBox";

class MessageBoxCallbacks {
  constructor(
    public readonly onFulfilled: (result: MessageBoxValue) => void,
    public readonly onRejected: (result: any) => void,
  ) { }

  public handleMessageBoxResult = (result: MessageBoxValue) => {
    this.onFulfilled(result);
  }
}

/** [[MessageAddedEvent]] arguments.
 */
export interface MessageAddedEventArgs {
  message: NotifyMessageDetails;
}

/** Message Added Event class.
 */
export class MessageAddedEvent extends UiEvent<MessageAddedEventArgs> { }

/** The MessageManager class manages messages and prompts. It is used by the [[AppNotificationManager]] class.
 */
export class MessageManager {
  private static _maxCachedMessages = 500;
  private static _messages: NotifyMessageDetails[] = new Array<NotifyMessageDetails>();
  private static _MessageAddedEvent: MessageAddedEvent = new MessageAddedEvent();

  /** The MessageAddedEvent is fired when a message is added via IModelApp.notifications.ouptputMessage(). */
  public static get onMessageAddedEvent(): MessageAddedEvent { return this._MessageAddedEvent; }

  /** List of messages as [[NotifyMessageDetails]]. */
  public static get messages(): Readonly<NotifyMessageDetails[]> { return this._messages; }

  /** Output a message and/or alert to the user. */
  public static addMessage(message: NotifyMessageDetails): void {
    this._messages.push(message);

    if (this._messages.length > this._maxCachedMessages) {
      const numToErase = this._maxCachedMessages / 4;
      this._messages.splice(0, numToErase);
    }

    this.onMessageAddedEvent.emit({ message });
  }

  /** Output a prompt to the user. A 'prompt' indicates an action the user should take to proceed. */
  public static outputPrompt(_prompt: string): void {
    // TODO - outputPrompt
  }

  /** Gets an icon CSS class name based on a given [[NotifyMessageDetails]]. */
  public static getIconClassName(details: NotifyMessageDetails): string {
    let iconClassName = classnames("icon", "notifymessage-icon");

    switch (details.priority) {
      case OutputMessagePriority.Info:
        iconClassName = classnames(iconClassName, "icon-info", "message-box-information");
        break;
      case OutputMessagePriority.Warning:
        iconClassName = classnames(iconClassName, "icon-status-warning", "message-box-warning");
        break;
      case OutputMessagePriority.Error:
        iconClassName = classnames(iconClassName, "icon-status-error", "message-box-error");
        break;
      case OutputMessagePriority.Fatal:
        iconClassName = classnames(iconClassName, "icon-status-rejected", "message-box-error");
        break;
    }

    return iconClassName;
  }

  /** Gets a [[MessageSeverity]] based on a given [[NotifyMessageDetails]]. */
  public static getSeverity(details: NotifyMessageDetails): MessageSeverity {
    let severity = MessageSeverity.None;

    switch (details.priority) {
      case OutputMessagePriority.Info:
        severity = MessageSeverity.Information;
        break;
      case OutputMessagePriority.Warning:
        severity = MessageSeverity.Warning;
        break;
      case OutputMessagePriority.Error:
        severity = MessageSeverity.Error;
        break;
      case OutputMessagePriority.Fatal:
        severity = MessageSeverity.Fatal;
        break;
    }

    return severity;
  }

  /** Output a MessageBox and wait for response from the user.
   * @param mbType       The MessageBox type.
   * @param message      The message to display.
   * @param icon         The MessageBox icon type.
   * @return the response from the user.
   */
  public static openMessageBox(mbType: MessageBoxType, message: string, icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const title = UiFramework.i18n.translate("UiFramework:general.alert");

    return new Promise((onFulfilled: (result: MessageBoxValue) => void, onRejected: (reason: any) => void) => {
      const messageBoxCallbacks = new MessageBoxCallbacks(onFulfilled, onRejected);
      ModalDialogManager.openModalDialog(this.standardMessageBox(mbType, icon, title, message, messageBoxCallbacks));
    });
  }

  private static standardMessageBox(mbType: MessageBoxType, iconType: MessageBoxIconType, title: string, message: string, callbacks: MessageBoxCallbacks): React.ReactNode {
    return (
      <StandardMessageBox
        opened={true}
        messageBoxType={mbType}
        iconType={iconType}
        title={title}
        onResult={callbacks.handleMessageBoxResult}
      >
        {message}
      </StandardMessageBox>
    );
  }

}
