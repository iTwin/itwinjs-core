/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";

import { CommonProps } from "@bentley/ui-core";
import { DialogChangedEvent, DialogManagerBase, DialogRendererBase } from "./DialogManagerBase";

/** Modal Dialog Changed Event class.
 * @public
 */
export class ModalDialogChangedEvent extends DialogChangedEvent { }

/** Modal Dialog Manager class.
 * @public
 */
export class ModalDialogManager {
  /** Modal Dialog Changed Event */
  public static readonly onModalDialogChangedEvent = new ModalDialogChangedEvent();

  /** @internal */
  public static readonly dialogManager: DialogManagerBase = new DialogManagerBase(ModalDialogManager.onModalDialogChangedEvent);

  /** Get the array of modal dialogs */
  public static get dialogs() { return ModalDialogManager.dialogManager.dialogs; }

  /** Open a modal dialog
   * @param dialog The Dialog to open
   * @param id The id of the Dialog. If one is not provided, an id is generated.
   */
  public static openDialog(dialog: React.ReactNode, id?: string): void {
    ModalDialogManager.dialogManager.openDialog(dialog, id);
  }

  /** Close a modal dialog
   * @param dialog The Dialog to open. If one is not specified, the active dialog will be closed.
   */
  public static closeDialog(dialog?: React.ReactNode): void {
    ModalDialogManager.dialogManager.closeDialog(dialog);
  }

  /** Update the dialogs */
  public static update(): void {
    ModalDialogManager.dialogManager.update();
  }

  /** Get the active modal dialog */
  public static get activeDialog(): React.ReactNode | undefined {
    return ModalDialogManager.dialogManager.activeDialog;
  }

  /** Get the count of modal dialogs */
  public static get dialogCount(): number {
    return ModalDialogManager.dialogManager.dialogCount;
  }
}

/** ModalDialogRenderer React component.
 * @public
 */
export class ModalDialogRenderer extends React.PureComponent<CommonProps> {

  constructor(props: CommonProps) {
    super(props);
  }

  public render(): React.ReactNode {
    return (
      <DialogRendererBase {...this.props} dialogManager={ModalDialogManager.dialogManager} />
    );
  }
}
