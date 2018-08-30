/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import * as classnames from "classnames";
import {
  ActivityMessageDetails,
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

/** Activity Message Event Args class.
 */
export interface ActivityMessageEventArgs {
  message: string;
  percentage: number;
  details?: ActivityMessageDetails;
  restored?: boolean;
}

/** Message Added Event class.
 */
export class MessageAddedEvent extends UiEvent<MessageAddedEventArgs> { }

/** Activity Message Added Event class.
 */
export class ActivityMessageAddedEvent extends UiEvent<ActivityMessageEventArgs> { }

/** Activity Message Canceled Event class.
 */
export class ActivityMessageCanceledEvent extends UiEvent<{}> { }

/**
 * Keeps track of the current activity message, and updates whenever
 * setupActivityMessageDetails() or setupActivityMessageValues()
 * is called.
 * Used to display tracked progress in ActivityMessage.
 */
class OngoingActivityMessage {
  private _message: string = "";
  private _percentage: number = 0;
  private _details: ActivityMessageDetails = new ActivityMessageDetails(true, true, true);
  private _restored: boolean = false;

  public get Message(): string { return this._message; }
  public set Message(title: string) { this._message = title; }

  public get Percentage(): number { return this._percentage; }
  public set Percentage(percentage: number) { this._percentage = percentage; }

  public get Details(): ActivityMessageDetails { return this._details; }
  public set Details(details: ActivityMessageDetails) { this._details = details; }

  public get IsRestored(): boolean { return this._restored; }
  public set IsRestored(_restored: boolean) { this._restored = _restored; }
}

/** The MessageManager class manages messages and prompts. It is used by the [[AppNotificationManager]] class.
 */
export class MessageManager {
  private static _maxCachedMessages = 500;
  private static _messages: NotifyMessageDetails[] = new Array<NotifyMessageDetails>();
  private static _MessageAddedEvent: MessageAddedEvent = new MessageAddedEvent();

  private static _ActivityMessageAddedEvent: ActivityMessageAddedEvent = new ActivityMessageAddedEvent();
  private static _ActivityMessageCanceledEvent: ActivityMessageCanceledEvent = new ActivityMessageCanceledEvent();
  private static _OngoingActivityMessage: OngoingActivityMessage = new OngoingActivityMessage();

  /** The MessageAddedEvent is fired when a message is added via IModelApp.notifications.ouptputMessage(). */
  public static get onMessageAddedEvent(): MessageAddedEvent { return this._MessageAddedEvent; }
  public static get onActivityMessageAddedEvent(): ActivityMessageAddedEvent { return this._ActivityMessageAddedEvent; }
  public static get onActivityMessageCanceledEvent(): ActivityMessageCanceledEvent { return this._ActivityMessageCanceledEvent; }

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

  /**
   * Sets details on _OngoingActivityMessage to be referenced when displaying
   * an ActivityMessage.
   * @param details    Details for setup of ActivityMessage
   * @returns true if details is valid and can be used to display ActivityMessage
   */
  public static setupActivityMessageDetails(details: ActivityMessageDetails): boolean {
    if (!details)
      return false;

    this._OngoingActivityMessage.Details = details;
    this._OngoingActivityMessage.IsRestored = true;
    return true;
  }

  /**
   * Sets values on _OngoingActivityMessage to be referenced when displaying
   * an ActivityMessage.
   * @param message     Message of the process that ActivityMessage is tracking
   * @param percentage  Progress made by activity in percentage
   * @param restored    True if original ActivityMessage has been closed and
   *                    is now being restored from the status bar.
   * @returns true if details is valid and can be used to display ActivityMessage
   */
  public static setupActivityMessageValues(message: string, percentage: number, restored?: boolean): boolean {
    if (!message || !percentage)
      return false;

    this._OngoingActivityMessage.Message = message;
    this._OngoingActivityMessage.Percentage = percentage;

    this.onActivityMessageAddedEvent.emit({
      message,
      percentage,
      details: this._OngoingActivityMessage.Details,
      restored: (restored !== undefined) ? restored : this._OngoingActivityMessage.IsRestored,
    });

    this._OngoingActivityMessage.IsRestored = false;

    return true;
  }

  /**
   * Dismisses current ActivityMessage and ends activity if canceled.
   * @param isCompleted   True if the activity was completed, false if it was canceled
   * @returns True if both ActivityMessage and activity process are ended.
   */
  public static endActivityMessage(isCompleted: boolean): boolean {
    this.endActivityProcessing(isCompleted);
    this.onActivityMessageCanceledEvent.emit({});
    return true;
  }

  /**
   * Ends processing for activity according to message definition.
   * @param isCompleted   True if the activity was completed, false if it was canceled
   */
  private static endActivityProcessing(isCompleted: boolean): void {
    if (isCompleted)
      this._OngoingActivityMessage.Details.onActivityCompleted();
    else
      this._OngoingActivityMessage.Details.onActivityCancelled();
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
