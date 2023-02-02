/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import * as React from "react";
import { Logger } from "@itwin/core-bentley";
import { UiFramework } from "../UiFramework";
import { DialogManagerBase } from "./DialogManagerBase";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { ModelessDialogChangedEvent, ModelessDialogInfo } from "../framework/FrameworkDialogs";

// cSpell:ignore ZINDEX modeless

/** Modeless Dialog Manager class displays and manages multiple modeless dialogs
 * @internal
 */
export class InternalModelessDialogManager {
  /** Modeless Dialog Changed Event */
  public static readonly onModelessDialogChangedEvent = new ModelessDialogChangedEvent();

  /** @internal */
  public static readonly dialogManager: DialogManagerBase = new DialogManagerBase(InternalModelessDialogManager.onModelessDialogChangedEvent);

  /** Get the array of modeless dialogs */
  public static get dialogs() { return InternalModelessDialogManager.dialogManager.dialogs; }

  private static _dialogMap = new Map<string, ModelessDialogInfo>();
  private static _idArray = new Array<string>();

  /** Initialize the modeless dialog manager
   * @internal
  */
  public static initialize(): void {
    DialogManagerBase.initialize();
  }

  /** Open a modeless dialog
   * @param dialog The Dialog to open
   * @param id The id of the Dialog to open
   */
  public static open(dialog: React.ReactNode, id: string, parentDocument = document): void {
    const dialogInfo = InternalModelessDialogManager._dialogMap.get(id);
    if (dialogInfo) {
      const message = `Dialog with id of '${id}' already opened`;
      Logger.logInfo(UiFramework.loggerCategory(this), `openDialog: ${message}`);
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, message, undefined, OutputMessageType.Toast));
      return;
    }
    InternalModelessDialogManager._dialogMap.set(id, { reactNode: dialog, zIndex: DialogManagerBase.topZIndex, parentDocument });
    InternalModelessDialogManager._idArray.push(id);
    InternalModelessDialogManager.dialogManager.openDialog(dialog, id, parentDocument);
  }

  /** Close a modeless dialog
   * @param id The id of the Dialog to close.
   */
  public static close(id: string): void {
    const dialogInfo = InternalModelessDialogManager._dialogMap.get(id);
    if (dialogInfo) {
      InternalModelessDialogManager.dialogManager.removeDialog(dialogInfo.reactNode);
      InternalModelessDialogManager._dialogMap.delete(id);
      const index = InternalModelessDialogManager._idArray.indexOf(id);
      // istanbul ignore else
      if (index >= 0)
        InternalModelessDialogManager._idArray.splice(index, 1);

      if (InternalModelessDialogManager.active === undefined)
        DialogManagerBase.topZIndex = DialogManagerBase.getDialogZIndexDefault();

      this.update();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `closeDialog: Could not find dialog with id of '${id}'`);
    }
  }

  /** @internal */
  public static closeAll(): void {
    InternalModelessDialogManager.dialogManager.closeAll();
  }

  /** Update the dialogs */
  public static update(): void {
    InternalModelessDialogManager.dialogManager.update();
  }

  /** Get the active modeless dialog */
  public static get active(): React.ReactNode | undefined {
    if (InternalModelessDialogManager._idArray.length > 0) {
      const id = InternalModelessDialogManager._idArray[InternalModelessDialogManager._idArray.length - 1];
      const dialogInfo = InternalModelessDialogManager._dialogMap.get(id);
      // istanbul ignore else
      if (dialogInfo)
        return dialogInfo.reactNode;
    }

    return undefined;
  }

  /** Get the count of modeless dialogs */
  public static get count(): number {
    return InternalModelessDialogManager.dialogManager.dialogCount;
  }

  /** Handle a pointer down event on a modeless dialog */
  public static handlePointerDownEvent(_event: React.PointerEvent, id: string, updateFunc: () => void): void {
    const dialogInfo = InternalModelessDialogManager._dialogMap.get(id);
    if (dialogInfo && dialogInfo.reactNode !== InternalModelessDialogManager.active) {
      DialogManagerBase.topZIndex += 1;
      dialogInfo.zIndex = DialogManagerBase.topZIndex;

      InternalModelessDialogManager._idArray.splice(InternalModelessDialogManager._idArray.indexOf(id), 1);
      InternalModelessDialogManager._idArray.push(id);

      updateFunc();
      this.update();
    }
  }

  /** Get the z-index for a modeless dialog */
  public static getZIndex(id: string): number {
    let zIndex = DialogManagerBase.getDialogZIndexDefault();
    const dialogInfo = InternalModelessDialogManager._dialogMap.get(id);
    // istanbul ignore else
    if (dialogInfo)
      zIndex = dialogInfo.zIndex;
    return zIndex;
  }

  public static getInfo(id: string): ModelessDialogInfo | undefined {
    return InternalModelessDialogManager._dialogMap.get(id);
  }
}
