/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
import { UiEvent, MessageContainer, MessageSeverity } from "@bentley/ui-core";
import UiFramework from "../UiFramework";
import { ModalDialogManager } from "./ModalDialogManager";
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

/** Input Field Message Event Args class.
 */
export interface InputFieldMessageEventArgs {
  target: Element;
  messageText: string;
}

/** Message Added Event class.
 */
export class MessageAddedEvent extends UiEvent<MessageAddedEventArgs> { }

/** Activity Message Added Event class.
 */
export class ActivityMessageUpdatedEvent extends UiEvent<ActivityMessageEventArgs> { }

/** Activity Message Cancelled Event class.
 */
export class ActivityMessageCancelledEvent extends UiEvent<{}> { }

/** Input Field Message Added Event class
 */
export class InputFieldMessageAddedEvent extends UiEvent<InputFieldMessageEventArgs> { }

/** Input Field Message Removed Event class.
 */
export class InputFieldMessageRemovedEvent extends UiEvent<{}> { }

/**
 * Keeps track of the current activity message, and updates whenever
 * setupActivityMessageDetails() or setupActivityMessageValues()
 * is called.
 * Used to display tracked progress in ActivityMessage.
 */
class OngoingActivityMessage {
  public message: string = "";
  public percentage: number = 0;
  public details: ActivityMessageDetails = new ActivityMessageDetails(true, true, true);
  public isRestored: boolean = false;
}

/** The MessageManager class manages messages and prompts. It is used by the [[AppNotificationManager]] class.
 */
export class MessageManager {
  private static _maxCachedMessages = 500;
  private static _messages: NotifyMessageDetails[] = new Array<NotifyMessageDetails>();
  private static _MessageAddedEvent: MessageAddedEvent = new MessageAddedEvent();

  private static _ActivityMessageUpdatedEvent: ActivityMessageUpdatedEvent = new ActivityMessageUpdatedEvent();
  private static _ActivityMessageCancelledEvent: ActivityMessageCancelledEvent = new ActivityMessageCancelledEvent();
  private static _OngoingActivityMessage: OngoingActivityMessage = new OngoingActivityMessage();

  private static _InputFieldMessageAddedEvent: InputFieldMessageAddedEvent = new InputFieldMessageAddedEvent();
  private static _InputFieldMessageRemovedEvent: InputFieldMessageRemovedEvent = new InputFieldMessageRemovedEvent();

  /** The MessageAddedEvent is fired when a message is added via IModelApp.notifications.ouptputMessage(). */
  public static get onMessageAddedEvent(): MessageAddedEvent { return this._MessageAddedEvent; }

  /** The ActivityMessageUpdatedEvent is fired when an Activity message updates via IModelApp.notifications.outputActivityMessage(). */
  public static get onActivityMessageUpdatedEvent(): ActivityMessageUpdatedEvent { return this._ActivityMessageUpdatedEvent; }

  /** The ActivityMessageCancelledEvent is fired when an Activity message is cancelled via
   * IModelApp.notifications.endActivityMessage(ActivityMessageEndReason.Cancelled) or
   * by the user clicking the 'Cancel' link.
   */
  public static get onActivityMessageCancelledEvent(): ActivityMessageCancelledEvent { return this._ActivityMessageCancelledEvent; }

  public static get onInputFieldMessageAddedEvent(): InputFieldMessageAddedEvent { return this._InputFieldMessageAddedEvent; }
  public static get onInputFieldMessageRemovedEvent(): InputFieldMessageRemovedEvent { return this._InputFieldMessageRemovedEvent; }

  /** List of messages as NotifyMessageDetails. */
  public static get messages(): Readonly<NotifyMessageDetails[]> { return this._messages; }

  /** Clear the message list. */
  public static clearMessages(): void {
    this._messages.splice(0);
  }

  /** Output a message and/or alert to the user.
   * @param  message  Details about the message to output.
   */
  public static addMessage(message: NotifyMessageDetails): void {
    this._messages.push(message);

    if (this._messages.length > this._maxCachedMessages) {
      const numToErase = this._maxCachedMessages / 4;
      this._messages.splice(0, numToErase);
    }

    this.onMessageAddedEvent.emit({ message });
  }

  /**
   * Sets details for setting up an Activity message.
   * @param details    Details for setup of ActivityMessage
   * @returns true if details is valid and can be used to display ActivityMessage
   */
  public static setupActivityMessageDetails(details: ActivityMessageDetails): boolean {
    this._OngoingActivityMessage.details = details;
    this._OngoingActivityMessage.isRestored = true;
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
    this._OngoingActivityMessage.message = message;
    this._OngoingActivityMessage.percentage = percentage;

    this.onActivityMessageUpdatedEvent.emit({
      message,
      percentage,
      details: this._OngoingActivityMessage.details,
      restored: (restored !== undefined) ? restored : this._OngoingActivityMessage.isRestored,
    });

    this._OngoingActivityMessage.isRestored = false;

    return true;
  }

  /**
   * Dismisses current ActivityMessage and ends activity if canceled.
   * @param isCompleted   True if the activity was completed, false if it was canceled
   * @returns True if both ActivityMessage and activity process are ended.
   */
  public static endActivityMessage(isCompleted: boolean): boolean {
    this.endActivityProcessing(isCompleted);
    this.onActivityMessageCancelledEvent.emit({});
    return true;
  }

  /**
   * Ends processing for activity according to message definition.
   * @param isCompleted   True if the activity was completed, false if it was canceled
   */
  private static endActivityProcessing(isCompleted: boolean): void {
    if (isCompleted)
      this._OngoingActivityMessage.details.onActivityCompleted();
    else
      this._OngoingActivityMessage.details.onActivityCancelled();
  }

  /**
   * Displays an input field message near target element.
   * @param target  The currently focused or recently focused element to place the
   *                input field message near.
   * @param messageText   Text to display in the message.
   */
  public static displayInputFieldMessage(target: Element, messageText: string) {
    this.onInputFieldMessageAddedEvent.emit({
      target,
      messageText,
    });
  }

  /**
   * Hides the currently displayed input field message.
   */
  public static hideInputFieldMessage() {
    this.onInputFieldMessageRemovedEvent.emit({});
  }

  /** Output a prompt to the user. A 'prompt' indicates an action the user should take to proceed. */
  public static outputPrompt(_prompt: string): void {
    UiFramework.store.dispatch({ type: "ConfigurableUi:SET_TOOLPROMPT", payload: _prompt });
    // TODO - outputPrompt
  }

  /** Gets an icon CSS class name based on a given NotifyMessageDetails. */
  public static getIconClassName(details: NotifyMessageDetails): string {
    const severity = MessageManager.getSeverity(details);
    const className = MessageContainer.getIconClassName(severity, false);
    const iconClassName = classnames("icon", "notifymessage-icon", className);

    return iconClassName;
  }

  /** Gets a [[MessageSeverity]] based on a given NotifyMessageDetails. */
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
