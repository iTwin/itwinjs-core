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
import { ModelessDialogInfo } from "../framework/FrameworkDialogs";
import { InternalModelessDialogManager as internal } from "./InternalModelessDialogManager";

// cSpell:ignore ZINDEX modeless

/** ModelessDialogRenderer React component renders modeless dialogs.
 * @public
 */
export class ModelessDialogRenderer extends React.PureComponent<CommonProps> {

  constructor(props: CommonProps) {
    super(props);
  }

  public override render(): React.ReactNode {
    return (
      <DialogRendererBase {...this.props} dialogManager={internal.dialogManager} />
    );
  }
}

/** Modeless Dialog Manager class displays and manages multiple modeless dialogs
 * @public
 * @deprecated in 3.6. Use `UiFramework.dialogs.modeless` property.
 */
export class ModelessDialogManager {
  /** Initialize the modeless dialog manager
   * @deprecated in 3.6. This is called internally.
  */
  public static initialize(): void {
    internal.initialize();
  }

  /** Modeless Dialog Changed Event */
  public static get onModelessDialogChangedEvent() { return internal.onModelessDialogChangedEvent; }

  /** @internal */
  public static get dialogManager() { return internal.dialogManager; }

  /** Get the array of modeless dialogs */
  public static get dialogs() { return internal.dialogs; }

  /** Open a modeless dialog
     * @param dialog The Dialog to open
     * @param id The id of the Dialog to open
     */
  public static openDialog(dialog: React.ReactNode, id: string, parentDocument = document): void {
    return internal.open(dialog, id, parentDocument);
  }

  /** Close a modeless dialog
     * @param id The id of the Dialog to close.
     */
  public static closeDialog(id: string): void {
    return internal.close(id);
  }

  /** @internal */
  public static closeAll(): void {
    return internal.closeAll();
  }

  /** Update the dialogs */
  public static update(): void {
    return internal.update();
  }

  /** Get the active modeless dialog */
  public static get activeDialog(): React.ReactNode | undefined {
    return internal.active;
  }

  /** Get the count of modeless dialogs */
  public static get dialogCount(): number {
    return internal.count;
  }

  /** Handle a pointer down event on a modeless dialog */
  public static handlePointerDownEvent(_event: React.PointerEvent, id: string, updateFunc: () => void): void {
    return internal.handlePointerDownEvent(_event, id, updateFunc);
  }

  /** Get the z-index for a modeless dialog */
  public static getDialogZIndex(id: string): number {
    return internal.getZIndex(id);
  }

  public static getDialogInfo(id: string): ModelessDialogInfo | undefined {
    return internal.getInfo(id);
  }
}
