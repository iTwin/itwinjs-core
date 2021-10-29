/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import { MessageSeverity } from "./MessageSeverity";

/** Describes the type and behavior of a display message.
 * @public
 */
export enum DisplayMessageType {
  /** Temporary message that displays at the bottom of the screen. */
  Toast = 0,
  /** Message with a close button that displays at the bottom of the screen. */
  Sticky = 2,
  /** Message that displays near a specified HTML element. */
  InputField = 3,
  /** Modal message box. */
  Alert = 4,
}

/** MessagePresenter interface functions display messages.
 * @public
 */
export interface MessagePresenter {
  /**
   * Displays a message.
   * @param severity          The severity of the message.
   * @param briefMessage      A short message that conveys the simplest explanation of the issue.
   * @param detailedMessage   An optional comprehensive message that explains the issue in detail and potentially offers a solution.
   * @param messageType       The type of message. Defaults to Toast.
   */
  displayMessage(severity: MessageSeverity, briefMessage: HTMLElement | string, detailedMessage?: HTMLElement | string, messageType?: DisplayMessageType): void;

  /**
   * Displays an input field message.
   * @param inputField        Input field to which the message pertains. The message will be shown just below this input field element.
   * @param severity          The severity of the message.
   * @param briefMessage      A short message that conveys the simplest explanation of the issue.
   * @param detailedMessage   An optional comprehensive message that explains the issue in detail and potentially offers a solution.
   */
  displayInputFieldMessage(inputField: HTMLElement, severity: MessageSeverity, briefMessage: HTMLElement | string, detailedMessage?: HTMLElement | string): void;

  /**
   * Close message created with `displayInputFieldMessage`.
   */
  closeInputFieldMessage(): void;
}
