/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import classnames from "classnames";
import * as _ from "lodash";
import * as React from "react";
import { XAndY } from "@itwin/core-geometry";
import {
  ActivityMessageDetails, IModelApp, MessageBoxIconType, MessageBoxType, MessageBoxValue, OutputMessageAlert, OutputMessagePriority,
  OutputMessageType, ToolAssistanceInstructions, ToolTipOptions,
} from "@itwin/core-frontend";
import { MessageSeverity, UiEvent } from "@itwin/appui-abstract";
import { MessageContainer } from "@itwin/core-react";
import { ConfigurableUiActionId } from "../configurableui/state";
import { ModalDialogManager } from "../dialog/ModalDialogManager";
import { StandardMessageBox } from "../dialog/StandardMessageBox";
import { ElementTooltip } from "../feedback/ElementTooltip";
import { UiFramework } from "../UiFramework";
import { MessageSpan } from "./MessageSpan";
import { PointerMessage } from "./Pointer";
import { NotifyMessageDetailsType, NotifyMessageType } from "./ReactNotifyMessageDetails";
import { StatusMessageManager } from "./StatusMessageManager";

class MessageBoxCallbacks {
  constructor(
    public readonly onFulfilled: (result: MessageBoxValue) => void,
    public readonly onRejected: (result: any) => void,
  ) { }

  public handleMessageBoxResult = (result: MessageBoxValue) => {
    this.onFulfilled(result);
  };
}

/** [[MessageAddedEvent]] arguments.
 * @public
 */
export interface MessageAddedEventArgs {
  /** Message details for the message added */
  message: NotifyMessageDetailsType;
}

/** Activity Message Event arguments.
 * @public
 */
export interface ActivityMessageEventArgs {
  /** Current message for the activity */
  message: NotifyMessageType;
  /** Current percentage for the activity */
  percentage: number;
  /** Message details set by calling NotificationManager.setupActivityMessage */
  details?: ActivityMessageDetails;
  /** Indicates whether the activity message popup is being restored */
  restored?: boolean;
}

/** Input Field Message Event arguments.
 * @public
 */
export interface InputFieldMessageEventArgs {
  /** Target HTML element for the Input Field message */
  target: Element;
  /** Message to be displayed near the input field */
  messageText: NotifyMessageType;
  /** Detailed message to be displayed near the input field */
  detailedMessage: NotifyMessageType;
  /** Priority of the input field message */
  priority: OutputMessagePriority;
}

/** Tool Assistance Changed event arguments.
 * @public
 */
export interface ToolAssistanceChangedEventArgs {
  /** Tool Assistance instructions for the active tool */
  instructions: ToolAssistanceInstructions | undefined;
}

/** Message Added Event class.
 * @public
 */
export class MessageAddedEvent extends UiEvent<MessageAddedEventArgs> { }

/** Messages Updated Event class.
 * @public
 */
export class MessagesUpdatedEvent extends UiEvent<{}> { }

/** Activity Message Added Event class.
 * @public
 */
export class ActivityMessageUpdatedEvent extends UiEvent<ActivityMessageEventArgs> { }

/** Activity Message Cancelled Event class.
 * @public
 */
export class ActivityMessageCancelledEvent extends UiEvent<{}> { }

/** Input Field Message Added Event class
 * @public
 */
export class InputFieldMessageAddedEvent extends UiEvent<InputFieldMessageEventArgs> { }

/** Input Field Message Removed Event class.
 * @public
 */
export class InputFieldMessageRemovedEvent extends UiEvent<{}> { }

/** Open Message Center Event class.
 * @public
 */
export class OpenMessageCenterEvent extends UiEvent<{}> { }

/** Tool Assistance Changed event class
 * @public
 */
export class ToolAssistanceChangedEvent extends UiEvent<ToolAssistanceChangedEventArgs> { }

/**
 * Keeps track of the current activity message, and updates whenever
 * setupActivityMessageDetails() or setupActivityMessageValues()
 * is called.
 * Used to display tracked progress in ActivityMessage.
 */
class OngoingActivityMessage {
  public message: NotifyMessageType = "";
  public percentage: number = 0;
  public details: ActivityMessageDetails = new ActivityMessageDetails(true, true, true);
  public isRestored: boolean = false;
}

/** The MessageManager class manages messages and prompts. It is used by the [[AppNotificationManager]] class.
 * @public
 */
export class MessageManager {
  private static _maxCachedMessages = 500;
  private static _maxDisplayedStickyMessages = 3;
  private static _messages: NotifyMessageDetailsType[] = [];
  private static _ongoingActivityMessage: OngoingActivityMessage = new OngoingActivityMessage();
  private static _lastMessage?: NotifyMessageDetailsType;
  private static _activeMessageManager = new StatusMessageManager();

  /** The MessageAddedEvent is fired when a message is added via outputMessage(). */
  public static readonly onMessageAddedEvent = new MessageAddedEvent();

  /** The MessagesUpdatedEvent is fired when a message is added or the messages are cleared. */
  public static readonly onMessagesUpdatedEvent = new MessagesUpdatedEvent();

  /** The ActivityMessageUpdatedEvent is fired when an Activity message updates via outputActivityMessage(). */
  public static readonly onActivityMessageUpdatedEvent = new ActivityMessageUpdatedEvent();

  /** The ActivityMessageCancelledEvent is fired when an Activity message is cancelled via
   * endActivityMessage(ActivityMessageEndReason.Cancelled) or
   * by the user clicking the 'Cancel' link.
   */
  public static readonly onActivityMessageCancelledEvent = new ActivityMessageCancelledEvent();

  public static readonly onInputFieldMessageAddedEvent = new InputFieldMessageAddedEvent();
  public static readonly onInputFieldMessageRemovedEvent = new InputFieldMessageRemovedEvent();

  public static readonly onOpenMessageCenterEvent = new OpenMessageCenterEvent();

  /** The ToolAssistanceChangedEvent is fired when a tool calls IModelApp.notifications.setToolAssistance().
   * @public
   */
  public static readonly onToolAssistanceChangedEvent = new ToolAssistanceChangedEvent();

  /** List of messages as NotifyMessageDetailsType. */
  public static get messages(): Readonly<NotifyMessageDetailsType[]> { return this._messages; }

  /** Manager of active messages. */
  public static get activeMessageManager(): StatusMessageManager { return this._activeMessageManager; }

  /** Clear the message list. */
  public static clearMessages(): void {
    this._messages.splice(0);
    this._activeMessageManager.initialize();

    this.onMessagesUpdatedEvent.emit({});
    this._lastMessage = undefined;
  }

  /** Update the message list. */
  public static updateMessages(): void {
    this.onMessagesUpdatedEvent.emit({});
  }

  /** Set the maximum number of cached message. */
  public static setMaxCachedMessages(max: number): void {
    this._maxCachedMessages = max;
    this.checkMaxCachedMessages();
  }

  /** The maximum number of displayed Sticky messages. */
  public static get maxDisplayedStickyMessages(): number { return this._maxDisplayedStickyMessages; }
  public static set maxDisplayedStickyMessages(max: number) { this._maxDisplayedStickyMessages = max; }

  /** Output a message and/or alert to the user.
   * @param  message  Details about the message to output.
   */
  public static outputMessage(message: NotifyMessageDetailsType): void {
    if (message.msgType === OutputMessageType.Pointer) {
      PointerMessage.showMessage(message);
    } else if (message.msgType === OutputMessageType.InputField) {
      if (message.inputField)
        MessageManager.displayInputFieldMessage(message.inputField, message.briefMessage, message.detailedMessage, message.priority);
      else
        message.msgType = OutputMessageType.Sticky; // Note: Changing the message.msgType here for InputField without inputField
    } else if (message.msgType === OutputMessageType.Alert) {
      if (message.openAlert === OutputMessageAlert.Balloon)
        message.msgType = OutputMessageType.Sticky; // Note: Changing the message.msgType here for Balloon
      else
        MessageManager.showAlertMessageBox(message);
    }

    MessageManager.addMessage(message);
  }

  /** Output a message and/or alert to the user.
   * @param  message  Details about the message to output.
   */
  public static addMessage(message: NotifyMessageDetailsType): void {
    if (!_.isEqual(message, this._lastMessage)) {
      this.addToMessageCenter(message);
      this._lastMessage = message;
    }

    this._activeMessageManager.add(message);

    this.onMessageAddedEvent.emit({ message });
  }

  /** Add a message to the Message Center.
   * @param  message  Details about the message to output.
   */
  public static addToMessageCenter(message: NotifyMessageDetailsType): void {
    this._messages.push(message);
    this.onMessagesUpdatedEvent.emit({});
    this.checkMaxCachedMessages();
  }

  /** Checks number of messages against the maximum. */
  private static checkMaxCachedMessages(): void {
    if (this._messages.length > this._maxCachedMessages) {
      const numToErase = this._maxCachedMessages / 4;
      this._messages.splice(0, numToErase);
      this.onMessagesUpdatedEvent.emit({});
    }
  }

  /**
   * Sets details for setting up an Activity message.
   * @param details    Details for setup of ActivityMessage
   * @returns true if details is valid and can be used to display ActivityMessage
   */
  public static setupActivityMessageDetails(details: ActivityMessageDetails): boolean {
    this._ongoingActivityMessage.details = details;
    this._ongoingActivityMessage.isRestored = details.showDialogInitially;
    return true;
  }

  /**
   * Output an activity message to the user.
   * @param message         The message text.
   * @param percentComplete The percentage of completion.
   * @return true if the message was displayed, false if the message could not be displayed.
   */
  public static outputActivityMessage(message: NotifyMessageType, percentComplete: number): boolean {
    return MessageManager.setupActivityMessageValues(message, percentComplete);
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
  public static setupActivityMessageValues(message: NotifyMessageType, percentage: number, restored?: boolean): boolean {
    this._ongoingActivityMessage.message = message;
    this._ongoingActivityMessage.percentage = percentage;

    this.onActivityMessageUpdatedEvent.emit({
      message,
      percentage,
      details: this._ongoingActivityMessage.details,
      restored: (restored !== undefined) ? restored : this._ongoingActivityMessage.isRestored,
    });

    this._ongoingActivityMessage.isRestored = false;

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
      this._ongoingActivityMessage.details.onActivityCompleted();
    else
      this._ongoingActivityMessage.details.onActivityCancelled();
  }

  /**
   * Displays an input field message near target element.
   * @param target  The currently focused or recently focused element to place the
   *                input field message near.
   * @param messageText  Text to display in the message.
   * @param detailedMessage   Optional detailed message text to display.
   * @param priority   Optional message priority which controls icon to display.
   */
  public static displayInputFieldMessage(target: HTMLElement, messageText: NotifyMessageType, detailedMessage: NotifyMessageType = "", priority = OutputMessagePriority.Error) {
    this.onInputFieldMessageAddedEvent.emit({
      target,
      messageText,
      detailedMessage,
      priority,
    });
  }

  /**
   * Hides the currently displayed input field message.
   */
  public static hideInputFieldMessage() {
    this.onInputFieldMessageRemovedEvent.emit({});
  }

  /**
   * Opens message center.
   */
  public static openMessageCenter() {
    this.onOpenMessageCenterEvent.emit({});
  }

  /** Output a prompt to the user. A 'prompt' indicates an action the user should take to proceed. */
  public static outputPrompt(prompt: string): void {
    UiFramework.dispatchActionToStore(ConfigurableUiActionId.SetToolPrompt, prompt, true);
  }

  /** Gets an icon CSS class name based on a given NotifyMessageDetailsType. */
  public static getIconClassName(details: NotifyMessageDetailsType): string {
    const severity = MessageManager.getSeverity(details);
    const className = MessageContainer.getIconClassName(severity, false);
    const iconClassName = classnames("icon", "notifymessage-icon", className);

    return iconClassName;
  }

  /** Gets a MessageSeverity based on a given NotifyMessageDetailsType. */
  public static getSeverity(details: NotifyMessageDetailsType): MessageSeverity {
    let severity = MessageSeverity.None;

    switch (details.priority) {
      case OutputMessagePriority.None:
        severity = MessageSeverity.None;
        break;
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

  /** Gets a MessageBoxIconType based on a given NotifyMessageDetailsType. */
  public static getIconType(details: NotifyMessageDetailsType): MessageBoxIconType {
    let iconType = MessageBoxIconType.NoSymbol;

    switch (details.priority) {
      case OutputMessagePriority.None:
        iconType = MessageBoxIconType.NoSymbol;
        break;
      case OutputMessagePriority.Info:
        iconType = MessageBoxIconType.Information;
        break;
      case OutputMessagePriority.Warning:
        iconType = MessageBoxIconType.Warning;
        break;
      case OutputMessagePriority.Error:
        iconType = MessageBoxIconType.Critical;
        break;
      case OutputMessagePriority.Fatal:
        iconType = MessageBoxIconType.Critical;
        break;
    }

    return iconType;
  }

  /** Output a MessageBox and wait for response from the user.
   * @param mbType       The MessageBox type.
   * @param message      The message to display.
   * @param icon         The MessageBox icon type.
   * @return the response from the user.
   */
  public static async openMessageBox(mbType: MessageBoxType, message: NotifyMessageType, icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const title = UiFramework.translate("general.alert");

    return new Promise((onFulfilled: (result: MessageBoxValue) => void, onRejected: (reason: any) => void) => {
      const messageBoxCallbacks = new MessageBoxCallbacks(onFulfilled, onRejected);
      const messageElement = <MessageSpan message={message} />;
      ModalDialogManager.openDialog(this.standardMessageBox(mbType, icon, title, messageElement, messageBoxCallbacks));
    });
  }

  /** @internal */
  public static showAlertMessageBox(messageDetails: NotifyMessageDetailsType): void {
    const title = UiFramework.translate("general.alert");
    const iconType = this.getIconType(messageDetails);
    const content = (
      <>
        <MessageSpan message={messageDetails.briefMessage} />
        {
          messageDetails.detailedMessage && (
            <p>
              <MessageSpan message={messageDetails.detailedMessage} />
            </p>
          )
        }
      </>
    );
    ModalDialogManager.openDialog(this.standardMessageBox(MessageBoxType.Ok, iconType, title, content));
  }

  private static standardMessageBox(mbType: MessageBoxType, iconType: MessageBoxIconType, title: string, messageElement: React.ReactNode, callbacks?: MessageBoxCallbacks): React.ReactNode {
    const onResult = (callbacks !== undefined) ? callbacks.handleMessageBoxResult : undefined;
    return (
      <StandardMessageBox
        opened={true}
        messageBoxType={mbType}
        iconType={iconType}
        title={title}
        onResult={onResult}
      >
        {messageElement}
      </StandardMessageBox>
    );
  }

  /** Setup tool assistance instructions for a tool. The instructions include the main instruction, which includes the current prompt.
   * @param instructions The tool assistance instructions.
   * @public
   */
  public static setToolAssistance(instructions: ToolAssistanceInstructions | undefined) {
    MessageManager.onToolAssistanceChangedEvent.emit({ instructions });
  }

  /** Show a tooltip window. Saves tooltip location for AccuSnap to test if cursor has moved far enough away to close tooltip.
   * @param htmlElement The HTMLElement that anchors the tooltip.
   * @param message     What to display inside the tooltip.
   * @param location    An optional location, relative to the origin of htmlElement, for the tooltip. If undefined, center of `htmlElement`.
   * @param options     Options that supply additional information about how the tooltip should function.
   */
  public static openToolTip(htmlElement: HTMLElement, message: NotifyMessageType, location?: XAndY, options?: ToolTipOptions): void {
    IModelApp.notifications.toolTipLocation.setFrom(location);
    ElementTooltip.showTooltip(htmlElement, message, location, options);
  }

  /** @internal */
  public static closeAllMessages(): void {
    ElementTooltip.hideTooltip();
    PointerMessage.hideMessage();
    MessageManager.clearMessages();
    MessageManager.hideInputFieldMessage();
    MessageManager.endActivityMessage(false);
  }

}
