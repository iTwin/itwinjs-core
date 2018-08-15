/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";

import {
  NotificationManager,
  MessageBoxValue,
  NotifyMessageDetails,
  MessageBoxType,
  MessageBoxIconType,
  ActivityMessageDetails,
  ActivityMessageEndReason,
  ToolTipOptions,
} from "@bentley/imodeljs-frontend";

import { XAndY } from "@bentley/geometry-core";

import { ModalDialogManager } from "./ModalDialogManager";
import { StandardMessageBox } from "./StandardMessageBox";
import { MessageManager } from "./MessageManager";
import { UiFramework } from "../UiFramework";
import { ElementTooltip } from "./ElementTooltip";

class MessageBoxCallbacks {
  constructor(
    public readonly onFulfilled: (result: MessageBoxValue) => void,
    public readonly onRejected: (result: any) => void,
  ) { }

  public handleMessageBoxResult = (result: MessageBoxValue) => {
    this.onFulfilled(result);
  }
}

/**
 * The NotificationManager controls the interaction with the user for prompts, error messages, and alert dialogs.
 * Implementations of the NotificationManager may present the information in different ways. For example, in
 * non-interactive sessions, these messages may be saved to a log file or simply discarded.
 */
export class AppNotificationManager extends NotificationManager {

  /** Output a prompt, given an i18n key. */
  public outputPromptByKey(key: string): void {
    this.outputPrompt(UiFramework.i18n.translate(key));
  }

  /** Output a prompt to the user. A 'prompt' indicates an action the user should take to proceed. */
  public outputPrompt(prompt: string): void {
    MessageManager.outputPrompt(prompt);
  }

  /** Output a message and/or alert to the user. */
  public outputMessage(message: NotifyMessageDetails): void {
    MessageManager.addMessage(message);
  }

  /** Output a MessageBox and wait for response from the user.
   * @param mbType       The MessageBox type.
   * @param message      The message to display.
   * @param icon         The MessageBox icon type.
   * @return the response from the user.
   */
  public openMessageBox(mbType: MessageBoxType, message: string, icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const title = UiFramework.i18n.translate("UiFramework:general.alert");

    return new Promise((onFulfilled: (result: MessageBoxValue) => void, onRejected: (reason: any) => void) => {
      const messageBoxCallbacks = new MessageBoxCallbacks(onFulfilled, onRejected);
      ModalDialogManager.openModalDialog(this.standardMessageBox(mbType, icon, title, message, messageBoxCallbacks));
    });
  }

  private standardMessageBox(mbType: MessageBoxType, iconType: MessageBoxIconType, title: string, message: string, callbacks: MessageBoxCallbacks): React.ReactNode {
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

  /**
   * Set up for activity messages.
   * @param details  The activity message details.
   * @return true if the message was displayed, false if an invalid priority is specified.
   */
  public setupActivityMessage(_details: ActivityMessageDetails): boolean {
    return false;
  }

  /**
   * Output an activity message to the user.
   * @param messageText      The message text.
   * @param percentComplete  The percentage of completion.
   * @return true if the message was displayed, false if the message could not be displayed.
   */
  public outputActivityMessage(_messageText: string, _percentComplete: number): boolean {
    return false;
  }

  /**
   * End an activity message.
   * @param reason       Reason for the end of the Activity Message.
   * @return true if the message was ended successfully, false if the activityMessage could not be ended.
   */
  public endActivityMessage(_reason: ActivityMessageEndReason): boolean {
    return false;
  }

  protected toolTipIsOpen(): boolean {
    return ElementTooltip.isTooltipVisible;
  }

  /** Clear the ToolTip if it is current open. If not open, does nothing. */
  public clearToolTip(): void {
    if (this.isToolTipOpen())
      ElementTooltip.hideTooltip();
  }

  /** Show a ToolTip window.
   * @param _el      The HTMLElement that that anchors the toolTip.
   * @param message  The message to display inside the ToolTip
   * @param _pt      An optional location, relative to the origin of el, for the ToolTip. If undefined, center of el.
   * @param _options Options that supply additional information about how the ToolTip should function.
   */
  public showToolTip(_el: HTMLElement, message: string, _pt?: XAndY, _options?: ToolTipOptions): void {
    ElementTooltip.showTooltip(message);
  }

}
