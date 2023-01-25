/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import * as React from "react";
import { DialogManagerBase } from "./DialogManagerBase";
import { ModalDialogChangedEvent } from "../framework/FrameworkDialogs";

/** Modal Dialog Manager class displays and manages multiple modal dialogs
 * @internal
 */
export class InternalModalDialogManager {
  /** Modal Dialog Changed Event */
  public static readonly onModalDialogChangedEvent = new ModalDialogChangedEvent();

  /** @internal */
  public static readonly dialogManager: DialogManagerBase = new DialogManagerBase(InternalModalDialogManager.onModalDialogChangedEvent);

  /** Get the array of modal dialogs */
  public static get dialogs() { return InternalModalDialogManager.dialogManager.dialogs; }

  /** Open a modal dialog
   * @param dialog The Dialog to open
   * @param id The id of the Dialog. If one is not provided, an id is generated.
   * @param parentDocument The Document used to determine the owning window.
   */
  public static openDialog(dialog: React.ReactNode, id?: string, parentDocument = document): void {
    InternalModalDialogManager.dialogManager.openDialog(dialog, id, parentDocument);
  }

  /** Close a modal dialog
   * @param dialog The Dialog to open. If one is not specified, the active dialog will be closed.
   */
  public static closeDialog(dialog?: React.ReactNode): void {
    InternalModalDialogManager.dialogManager.closeDialog(dialog);
  }

  /** @internal */
  public static closeAll(): void {
    InternalModalDialogManager.dialogManager.closeAll();
  }

  /** Update the dialogs */
  public static update(): void {
    InternalModalDialogManager.dialogManager.update();
  }

  /** Get the active modal dialog */
  public static get activeDialog(): React.ReactNode | undefined {
    return InternalModalDialogManager.dialogManager.activeDialog;
  }

  /** Get the count of modal dialogs */
  public static get dialogCount(): number {
    return InternalModalDialogManager.dialogManager.dialogCount;
  }
}
