/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

/** Describes the type and behavior of a notify message.
 * @public
 */
export enum NotifyMessageType {
  /** Temporary message that displays at the bottom of the screen. */
  Toast = 0,
  /** Message with a close button that displays at the bottom of the screen. */
  Sticky = 2,
  /** Message that displays near a specified HTML element. */
  InputField = 3,
  /** Modal message box. */
  Alert = 4,
}

/** Classifies a notify message by its level of importance.
 * @public
 */
export enum NotifyMessagePriority {
  None = 0,
  Error = 10,
  Warning = 11,
  Info = 12,
  Fatal = 17,
}

/** Describes the alert behavior of a notify message.
 * @public
 */
export enum NotifyMessageAlert {
  None = 0,
  Dialog = 1,
  Balloon = 2,
}

/** The NotifyMessageManager controls the interaction with the user for messages and alert dialogs.
 * Implementations of the NotifyMessageManager may present the information in different ways.
 * @public
 */
export class NotifyMessageManager {
}
