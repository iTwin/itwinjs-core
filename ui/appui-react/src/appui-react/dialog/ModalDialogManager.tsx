/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { DialogRendererBase } from "./DialogManagerBase";
import { InternalModalDialogManager as internal } from "./InternalModalDialogManager";

/** ModalDialogRenderer React component renders modal dialogs
 * @public
 */
export class ModalDialogRenderer extends React.PureComponent<CommonProps> {

  constructor(props: CommonProps) {
    super(props);
  }

  public override render(): React.ReactNode {
    return (
      <DialogRendererBase {...this.props} dialogManager={internal.dialogManager} />
    );
  }
}

/** Modal Dialog Manager class displays and manages multiple modal dialogs
 * @public
 * @deprecated in 3.6. Use `UiFramework.dialogs.modal` property.
 */
export class ModalDialogManager {
  /** Modal Dialog Changed Event */
  public static get onModalDialogChangedEvent() { return internal.onModalDialogChangedEvent; }

  /** @internal */
  public static get dialogManager() { return internal.dialogManager; }

  /** Get the array of modal dialogs */
  public static get dialogs() { return internal.dialogs; }

  /** Open a modal dialog
   * @param dialog The Dialog to open
   * @param id The id of the Dialog. If one is not provided, an id is generated.
   * @param parentDocument The Document used to determine the owning window.
   */
  public static openDialog(dialog: React.ReactNode, id?: string, parentDocument = document): void {
    internal.open(dialog, id, parentDocument);
  }

  /** Close a modal dialog
   * @param dialog The Dialog to open. If one is not specified, the active dialog will be closed.
   */
  public static closeDialog(dialog?: React.ReactNode): void {
    internal.close(dialog);
  }

  /** @internal */
  public static closeAll(): void {
    internal.closeAll();
  }

  /** Update the dialogs */
  public static update(): void {
    internal.update();
  }

  /** Get the active modal dialog */
  public static get activeDialog(): React.ReactNode | undefined {
    return internal.active;
  }

  /** Get the count of modal dialogs */
  public static get dialogCount(): number {
    return internal.count;
  }
}
