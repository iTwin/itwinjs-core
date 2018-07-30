/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as classnames from "classnames";
import { NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";
import { MessageSeverity } from "@bentley/ui-core";

/** Message Added Event Args class.
 */
export interface MessageAddedEventArgs {
  message: NotifyMessageDetails;
}

/** Message Added Event class.
 */
export class MessageAddedEvent extends UiEvent<MessageAddedEventArgs> { }

/** Manages messages and prompts.
 */
export class MessageManager {
  private static _maxCachedMessages = 500;
  private static _messages: NotifyMessageDetails[] = new Array<NotifyMessageDetails>();
  private static _MessageAddedEvent: MessageAddedEvent = new MessageAddedEvent();

  public static get MessageAddedEvent(): MessageAddedEvent { return this._MessageAddedEvent; }

  public static get Messages(): Readonly<NotifyMessageDetails[]> { return this._messages; }

  public static addMessage(message: NotifyMessageDetails): void {
    this._messages.push(message);

    if (this._messages.length > this._maxCachedMessages) {
      const numToErase = this._maxCachedMessages / 4;
      this._messages.splice(0, numToErase);
    }

    this.MessageAddedEvent.emit({ message });
  }

  public static outputPrompt(_prompt: string): void {
    // TODO - outputPrompt
  }

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
}
