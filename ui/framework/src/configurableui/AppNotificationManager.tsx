/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Notification */

import {
  ActivityMessageDetails,
  ActivityMessageEndReason,
  MessageBoxIconType,
  MessageBoxType,
  MessageBoxValue,
  NotificationManager,
  NotifyMessageDetails,
  ToolTipOptions,
} from "@bentley/imodeljs-frontend";

import { XAndY } from "@bentley/geometry-core";

import { MessageManager } from "./MessageManager";
import { UiFramework } from "../UiFramework";
import { ElementTooltip } from "./ElementTooltip";

/**
 * The AppNotificationManager class is a subclass of NotificationManager. This implementation uses
 * the iModelJs UI library to display alerts, messages, prompts and tooltips.
 *
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
    return MessageManager.openMessageBox(mbType, message, icon);
  }

  /**
   * Set up for activity messages.
   * @param details  The activity message details.
   * @return true if the message was displayed, false if an invalid priority is specified.
   */
  public setupActivityMessage(details: ActivityMessageDetails): boolean {
    return MessageManager.setupActivityMessageDetails(details);
  }

  /**
   * Output an activity message to the user.
   * @param messageText      The message text.
   * @param percentComplete  The percentage of completion.
   * @return true if the message was displayed, false if the message could not be displayed.
   */
  public outputActivityMessage(messageText: string, percentComplete: number): boolean {
    return MessageManager.setupActivityMessageValues(messageText, percentComplete);
  }

  /**
   * End an activity message.
   * @param reason       Reason for the end of the Activity Message.
   * @return true if the message was ended successfully, false if the activityMessage could not be ended.
   */
  public endActivityMessage(reason: ActivityMessageEndReason): boolean {
    switch (reason) {
      case (ActivityMessageEndReason.Completed):
        return MessageManager.endActivityMessage(true);
      case (ActivityMessageEndReason.Cancelled):
        return MessageManager.endActivityMessage(false);
    }
  }

  protected toolTipIsOpen(): boolean {
    return ElementTooltip.isTooltipVisible;
  }

  /** Clear the ToolTip if it is currently open. If not open, does nothing. */
  public clearToolTip(): void {
    if (this.isToolTipOpen)
      ElementTooltip.hideTooltip();
  }

  /** Show a ToolTip window.
   * @param el       The HTMLElement that that anchors the toolTip.
   * @param message  The message to display inside the ToolTip
   * @param pt       An optional location, relative to the origin of el, for the ToolTip. If undefined, center of el.
   * @param options  Options that supply additional information about how the ToolTip should function.
   */
  protected _showToolTip(el: HTMLElement, message: string, pt?: XAndY, options?: ToolTipOptions): void {
    ElementTooltip.showTooltip(el, message, pt, options);
  }
}
