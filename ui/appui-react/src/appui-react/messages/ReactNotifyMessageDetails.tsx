/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import type { BeDuration } from "@itwin/core-bentley";
import type { Point2d, XAndY } from "@itwin/core-geometry";
import type { OutputMessagePriority} from "@itwin/core-frontend";
import { NotifyMessageDetails, OutputMessageAlert, OutputMessageType } from "@itwin/core-frontend";
import { RelativePosition } from "@itwin/appui-abstract";
import type { MessageType } from "@itwin/core-react";

/** Types for message in [[MessageManager]]
 * @public
 */
export type NotifyMessageType = MessageType;

/** Types for NotifyMessageDetails.
 * @public
 */
export type NotifyMessageDetailsType = NotifyMessageDetails | ReactNotifyMessageDetails;

/** Describes a message to be displayed to the user and adds support for React components in messages.
 * @public
 */
export class ReactNotifyMessageDetails {
  private _notifyMessageDetails: NotifyMessageDetails;

  /** @internal */
  public get messageDetails(): NotifyMessageDetails { return this._notifyMessageDetails; }

  /** Amount of time a Toast message is displayed */
  public get displayTime(): BeDuration { return this._notifyMessageDetails.displayTime; }
  public set displayTime(duration: BeDuration) { this._notifyMessageDetails.displayTime = duration; }

  /** Anchor viewport for a Pointer message */
  public get viewport(): HTMLElement | undefined { return this._notifyMessageDetails.viewport; }
  /** Point for a Pointer message */
  public get displayPoint(): Point2d | undefined { return this._notifyMessageDetails.displayPoint; }
  /** Relative position for a Pointer message */
  public get relativePosition(): RelativePosition { return this._notifyMessageDetails.relativePosition; }
  /** Anchor input field for an Input Field message */
  public get inputField(): HTMLElement | undefined { return this._notifyMessageDetails.inputField; }

  /** Constructor
   *  @param priority           The priority this message should be accorded by the NotificationManager.
   *  @param briefMessage       A short message that conveys the simplest explanation of the issue.
   *  @param detailedMessage    A comprehensive message that explains the issue in detail and potentially offers a solution.
   *  @param msgType            The type of message.
   *  @param openAlert          Whether an alert box should be displayed or not, and if so what kind.
   */
  public constructor(
    public priority: OutputMessagePriority,
    public briefMessage: NotifyMessageType,
    public detailedMessage?: NotifyMessageType,
    public msgType = OutputMessageType.Toast,
    public openAlert = OutputMessageAlert.None) {
    /** Create an internal NotifyMessageDetails */
    this._notifyMessageDetails = new NotifyMessageDetails(priority, "", undefined, msgType, openAlert);
  }

  /** Set OutputMessageType.Pointer message details.
   * @param viewport            Viewport over which to display the Pointer type message.
   * @param displayPoint        Point at which to display the Pointer type message.
   * @param relativePosition    Position relative to displayPoint at which to display the Pointer type message.
   */
  public setPointerTypeDetails(viewport: HTMLElement, displayPoint: XAndY, relativePosition = RelativePosition.TopRight) {
    this._notifyMessageDetails.setPointerTypeDetails(viewport, displayPoint, relativePosition);
  }

  /** Set OutputMessageType.InputField message details.
   * @param inputField          Input field that message pertains. The message will be shown just below this input field element.
   */
  public setInputFieldTypeDetails(inputField: HTMLElement) {
    this._notifyMessageDetails.setInputFieldTypeDetails(inputField);
  }
}

/** ReactNotifyMessageDetails type guard.
 * @internal
 */
export const isReactNotifyMessageDetails = (details: any): details is ReactNotifyMessageDetails => {
  return (details as ReactNotifyMessageDetails).messageDetails !== undefined;
};
