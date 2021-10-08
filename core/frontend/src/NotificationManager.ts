/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notifications
 */
import { BeDuration } from "@itwin/core-bentley";
import { Point2d, XAndY } from "@itwin/core-geometry";
import { DisplayMessageType, MessagePresenter, MessageSeverity, RelativePosition } from "@itwin/appui-abstract";
import { IModelApp } from "./IModelApp";
import { ToolAssistanceInstructions } from "./tools/ToolAssistance";

// cSpell:words messagebox

/** Describes the type and behavior of a [[NotifyMessageDetails]].
 * @public
 */
export enum OutputMessageType {
  /** Temporary message box displays at the top or bottom of the screen then disappears automatically. */
  Toast = 0,
  /** Message box displays near the cursor over a Viewport and is closed by calling `closePointerMessage`. */
  Pointer = 1,
  /** Message box displays at the top or bottom of the screen and contains a Close button. */
  Sticky = 2,
  /** Message box displays near an input field and contains a Close button. */
  InputField = 3,
  /** Modal message box. */
  Alert = 4,
}

/** Classifies a [[NotifyMessageDetails]] by its level of importance.
 * @public
 */
export enum OutputMessagePriority {
  None = 0,
  Error = 10,
  Warning = 11,
  Info = 12,
  Debug = 13,
  Fatal = 17,
}

/** Describes the alert behavior of a [[NotifyMessageDetails]].
 * @public
 */
export enum OutputMessageAlert {
  None = 0,
  Dialog = 1,
  Balloon = 2,
}

/** Reason for ending the activity message via endActivityMessage
 * @public
 */
export enum ActivityMessageEndReason {
  Completed = 0,
  Cancelled = 1,
}

/** Describes the set of buttons displayed in a message box opened using [[NotificationManager.openMessageBox]].
 * @public
 */
export enum MessageBoxType {
  OkCancel,
  Ok,
  LargeOk,
  MediumAlert,
  YesNoCancel,
  YesNo,
}

/** Describes the icon displayed in a messagebox opened using [[NotificationManager.openMessageBox]].
 * @public
 */
export enum MessageBoxIconType {
  NoSymbol = 0,   // Means Don't draw Symbol
  Information = 1,   // Lower Case i
  Question = 2,   // Question Mark
  Warning = 3,   // Exclamation Point
  Critical = 4,   // Stop Sign
}

/** Describes the possible return values produced when the user clicks a button in a messagebox opened using [[NotificationManager.openMessageBox]].
 * @public
 */
export enum MessageBoxValue {
  Apply = 1,
  Reset = 2,
  Ok = 3,
  Cancel = 4,
  Default = 5,
  Yes = 6,
  No = 7,
  Retry = 8,
  Stop = 9,
  Help = 10,
  YesToAll = 11,
  NoToAll = 12,
}

/** Describes the behavior of a tooltip created using [[NotificationManager.openToolTip]].
 * @public
 */
export interface ToolTipOptions {
  duration?: BeDuration;
  placement?: string;
}

/** Describes a message to be displayed to the user.
 * @public
 */
export class NotifyMessageDetails {
  public displayTime = BeDuration.fromSeconds(5);
  public viewport?: HTMLElement;
  public inputField?: HTMLElement;
  public displayPoint?: Point2d;
  public relativePosition = RelativePosition.TopRight;

  /** Constructor
   * @param priority          The priority this message should be accorded by the NotificationManager.
   * @param briefMessage      A short message that conveys the simplest explanation of the issue.
   * @param detailedMessage   An optional comprehensive message that explains the issue in detail and potentially offers a solution.
   * @param msgType           The type of message. Defaults to Toast.
   * @param openAlert         Whether an alert box should be displayed or not, and if so what kind.
   */
  public constructor(public priority: OutputMessagePriority, public briefMessage: HTMLElement | string,
    public detailedMessage?: HTMLElement | string, public msgType = OutputMessageType.Toast, public openAlert = OutputMessageAlert.None) { }

  /** Set OutputMessageType.Pointer message details.
   * @param viewport          Viewport over which to display the Pointer type message.
   * @param displayPoint      Point at which to display the Pointer type message.
   * @param relativePosition  Position relative to displayPoint at which to display the Pointer type message.
   */
  public setPointerTypeDetails(viewport: HTMLElement, displayPoint: XAndY, relativePosition = RelativePosition.TopRight) {
    this.viewport = viewport;
    this.displayPoint = Point2d.fromJSON(displayPoint);
    this.relativePosition = relativePosition;
    this.msgType = OutputMessageType.Pointer;
  }

  /** Set OutputMessageType.InputField message details.
   * @param inputField        Input field to which the message pertains. The message will be shown just below this input field element.
   */
  public setInputFieldTypeDetails(inputField: HTMLElement) {
    this.inputField = inputField;
    this.msgType = OutputMessageType.InputField;
  }
}

/** Specifies the details of an activity message to be displayed to the user.
 * @public
 */
export class ActivityMessageDetails {
  public wasCancelled = false;

  /**
   * @param showProgressBar         Indicates whether to show the progress bar in the activity message dialog.
   * @param showPercentInMessage    Indicates whether to show the percentage complete in the activity message text.
   * @param supportsCancellation    Indicates whether to show the Cancel button, giving the user the ability to cancel the operation.
   * @param showDialogInitially     Indicates whether to show the activity message dialog initially. User can click status bar to open it.
   */
  public constructor(public showProgressBar: boolean, public showPercentInMessage: boolean, public supportsCancellation: boolean, public showDialogInitially: boolean = true) { }

  /** Called from NotificationAdmin when the user cancels the activity. */
  public onActivityCancelled() { this.wasCancelled = true; }

  /** Called from NotificationAdmin when the activity completes successfully. */
  public onActivityCompleted() { this.wasCancelled = false; }
}

/** The NotificationManager controls the interaction with the user for prompts, error messages, and alert dialogs.
 * Implementations of the NotificationManager may present the information in different ways. For example, in
 * non-interactive sessions, these messages may be saved to a log file or simply discarded.
 * @public
 */
export class NotificationManager implements MessagePresenter {
  public readonly toolTipLocation = new Point2d();

  /** Output a prompt, given a localization key.
   * @param key The key of the localized string with the prompt message.
   */
  public outputPromptByKey(key: string) { this.outputPrompt(IModelApp.localization.getLocalizedString(key)); }

  /** Output a localized prompt to the user. A 'prompt' indicates an action the user should take to proceed.
   * @param _prompt The localized string with the prompt message.
   */
  public outputPrompt(_prompt: string) { }

  /** Output a message and/or alert to the user.  */
  public outputMessage(_message: NotifyMessageDetails) { }

  /** Output a MessageBox and wait for response from the user.
   * @param _mbType       The MessageBox type.
   * @param _message      The message to display.
   * @param _icon         The MessageBox icon type.
   * @return the response from the user.
   */
  public async openMessageBox(_mbType: MessageBoxType, _message: HTMLElement | string, _icon: MessageBoxIconType): Promise<MessageBoxValue> { return MessageBoxValue.Ok; }

  /**
   * Set up for activity messages.
   * @param _details  The activity message details.
   * @return true if the message was displayed, false if an invalid priority is specified.
   */
  public setupActivityMessage(_details: ActivityMessageDetails) { return true; }

  /**
   * Output an activity message to the user.
   * @param _messageText The message text.
   * @param _percentComplete The percentage of completion.
   * @return true if the message was displayed, false if the message could not be displayed.
   */
  public outputActivityMessage(_messageText: HTMLElement | string, _percentComplete: number) { return true; }

  /**
   * End an activity message.
   * @param _reason The reason for the end of the Activity Message.
   * @return true if the message was ended successfully, false if the activityMessage could not be ended.
   */
  public endActivityMessage(_reason: ActivityMessageEndReason) { return true; }

  /** Return true if _showTooltip has an implementation and will display a tooltip. */
  public get isToolTipSupported(): boolean { return false; }

  /** Return true if the tooltip is currently open. */
  public get isToolTipOpen(): boolean { return false; }

  /** Implement to display a tooltip message at the specified location. */
  protected _showToolTip(_htmlElement: HTMLElement, _message: HTMLElement | string, _location?: XAndY, _options?: ToolTipOptions): void { }

  /** Show a tooltip window. Saves tooltip location for AccuSnap to test if cursor has moved far enough away to close tooltip.
   * @param htmlElement The HTMLElement that anchors the toolTip.
   * @param message What to display inside the ToolTip. May be a string or an HTMLElement.
   * @param location An optional location, relative to the origin of _htmlElement, for the ToolTip. If undefined, center of `htmlElement`
   * @param options Options that supply additional information about how the ToolTip should function.
   * @note If message is an HTMLElement, the notification manager will display the HTMLElement verbatim. This can represent a security
   * risk if any part the element is created from user input. Applications should be careful to *sanitize* any such input before
   * creating an HTMLElement to pass to this method.
   */
  public openToolTip(htmlElement: HTMLElement, message: HTMLElement | string, location?: XAndY, options?: ToolTipOptions): void {
    this.toolTipLocation.setFrom(location);
    this._showToolTip(htmlElement, message, location, options);
  }

  /** Clear the tooltip if it is currently open. */
  public clearToolTip(): void { }

  /** Update message position created with [[OutputMessageType.Pointer]].
   * @param displayPoint        Point at which to display the Pointer type message.
   * @param relativePosition    Position relative to displayPoint at which to display the Pointer type message.
   */
  public updatePointerMessage(_displayPoint: XAndY, _relativePosition = RelativePosition.TopRight): void { }

  /** Close message created with [[OutputMessageType.Pointer]]. */
  public closePointerMessage(): void { }

  /** Close message created with [[OutputMessageType.InputField]]. */
  public closeInputFieldMessage(): void { }

  /** Setup tool assistance instructions for a tool. The instructions include the main instruction, which includes the current prompt.
   * @param instructions The tool assistance instructions.
   */
  public setToolAssistance(instructions: ToolAssistanceInstructions | undefined) {
    this.outputPrompt(instructions ? instructions.mainInstruction.text : "");
  }

  /**
   * Displays a notification message.
   * @param severity          The severity of the message.
   * @param briefMessage      A short message that conveys the simplest explanation of the issue.
   * @param detailedMessage   An optional comprehensive message that explains the issue in detail and potentially offers a solution.
   * @param messageType       The type of message. Defaults to Toast.
   */
  public displayMessage(severity: MessageSeverity, briefMessage: HTMLElement | string, detailedMessage?: HTMLElement | string, messageType?: DisplayMessageType): void {
    const details = new NotifyMessageDetails(this.convertSeverityToPriority(severity), briefMessage, detailedMessage, this.convertMessageType(messageType));
    this.outputMessage(details);
  }

  /**
   * Displays an input field notification message.
   * @param inputField        Input field to which the message pertains. The message will be shown just below this input field element.
   * @param severity          The severity of the message.
   * @param briefMessage      A short message that conveys the simplest explanation of the issue.
   * @param detailedMessage   An optional comprehensive message that explains the issue in detail and potentially offers a solution.
   */
  public displayInputFieldMessage(inputField: HTMLElement, severity: MessageSeverity, briefMessage: HTMLElement | string, detailedMessage?: HTMLElement | string): void {
    const details = new NotifyMessageDetails(this.convertSeverityToPriority(severity), briefMessage, detailedMessage);
    details.setInputFieldTypeDetails(inputField);
    this.outputMessage(details);
  }

  private convertSeverityToPriority(severity: MessageSeverity): OutputMessagePriority {
    switch (severity) {
      case MessageSeverity.Information:
        return OutputMessagePriority.Info;
      case MessageSeverity.Warning:
        return OutputMessagePriority.Warning;
      case MessageSeverity.Error:
        return OutputMessagePriority.Error;
      case MessageSeverity.Fatal:
        return OutputMessagePriority.Fatal;
      case MessageSeverity.None:
      default:
        return OutputMessagePriority.None;
    }
  }

  private convertMessageType(inMessageType?: DisplayMessageType): OutputMessageType | undefined {
    switch (inMessageType) {
      case DisplayMessageType.Alert:
        return OutputMessageType.Alert;
      case DisplayMessageType.InputField:
        return OutputMessageType.InputField;
      case DisplayMessageType.Sticky:
        return OutputMessageType.Sticky;
      case DisplayMessageType.Toast:
        return OutputMessageType.Toast;
      default:
        return undefined;
    }
  }

}
