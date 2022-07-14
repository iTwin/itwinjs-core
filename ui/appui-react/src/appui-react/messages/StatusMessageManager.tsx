/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import { NotifyMessageDetailsType } from "./ReactNotifyMessageDetails";
import { MessageSeverity } from "@itwin/appui-abstract";
import { MessageManager } from "./MessageManager";
import { OutputMessageType } from "@itwin/core-frontend";

/** Interface for Status Message
 * @internal
 */
export interface StatusMessage {
  id: string;
  messageDetails: NotifyMessageDetailsType;
  severity: MessageSeverity;
}

/** Manager for Status messages
 * @internal
 */
export class StatusMessageManager {
  private _messages: ReadonlyArray<StatusMessage> = [];
  private _messageId: number = 0;

  public initialize() {
    this._messages = [];
    this._messageId = 0;
  }

  public get messages() { return this._messages; }

  public add(messageDetails: NotifyMessageDetailsType): void {
    const id = this._messageId.toString();
    const severity = MessageManager.getSeverity(messageDetails);

    const messages = this._messages.slice();
    messages.splice(0, 0, { id, messageDetails, severity });  // Insert at beginning
    this._messages = messages;

    this._messageId++;

    /** Remove Sticky messages beyond the max displayed */
    const stickyMessages = this._messages.filter((message) => message.messageDetails.msgType === OutputMessageType.Sticky);
    if (stickyMessages.length > MessageManager.maxDisplayedStickyMessages) {
      const removeMessages = stickyMessages.slice(MessageManager.maxDisplayedStickyMessages);
      for (const removeMessage of removeMessages) {
        this.remove(removeMessage.id);
      }
    }
  }

  public remove(id: string): boolean {
    let result = false;
    const foundIndex = this._messages.findIndex((message: StatusMessage) => message.id === id);

    // istanbul ignore else
    if (foundIndex >= 0) {
      const messages = this._messages.slice();
      messages.splice(foundIndex, 1);
      this._messages = messages;
      result = true;
    }

    return result;
  }
}
