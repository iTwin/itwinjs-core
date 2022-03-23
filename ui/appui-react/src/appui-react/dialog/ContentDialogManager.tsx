/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import * as React from "react";
import { Logger } from "@itwin/core-bentley";
import { CommonProps, getCssVariableAsNumber } from "@itwin/core-react";
import { UiFramework } from "../UiFramework";
import { DialogChangedEvent, DialogManagerBase, DialogRendererBase } from "./DialogManagerBase";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";

// cSpell:ignore ZINDEX modeless

/** Content Dialog Changed Event class.
 * @public
 */
export class ContentDialogChangedEvent extends DialogChangedEvent { }

/** @internal */
interface ContentDialogInfo {
  reactNode: React.ReactNode;
  zIndex: number;
  parentDocument: Document;
}

/** Used if the 'dialog' z-index CSS variable cannot be read */
const CONTENT_DIALOG_ZINDEX_DEFAULT = 2000;

/** Content Dialog Manager class displays and manages multiple modeless dialogs
 * @public
 */
export class ContentDialogManager {
  /** Content Dialog Changed Event */
  public static readonly onContentDialogChangedEvent = new ContentDialogChangedEvent();

  /** @internal */
  public static readonly dialogManager: DialogManagerBase = new DialogManagerBase(ContentDialogManager.onContentDialogChangedEvent);

  /** Get the array of modeless dialogs */
  public static get dialogs() { return ContentDialogManager.dialogManager.dialogs; }

  private static _dialogMap = new Map<string, ContentDialogInfo>();
  private static _idArray = new Array<string>();

  private static _topZIndex = CONTENT_DIALOG_ZINDEX_DEFAULT;

  /** Initialize the modeless dialog manager */
  public static initialize(): void {
    ContentDialogManager._topZIndex = ContentDialogManager.getDialogZIndexDefault();
  }

  private static getDialogZIndexDefault(): number {
    const variable = "--uicore-z-index-view-content-dialog";
    const value = getCssVariableAsNumber(variable);

    // istanbul ignore next
    if (!isNaN(value))
      return value;

    Logger.logError(UiFramework.loggerCategory(this), `'${variable}' CSS variable not found`);
    return CONTENT_DIALOG_ZINDEX_DEFAULT;
  }

  /** Open a modeless dialog
   * @param dialog The Dialog to open
   * @param id The id of the Dialog to open
   */
  public static openDialog(dialog: React.ReactNode, id: string, parentDocument = document): void {
    const dialogInfo = ContentDialogManager._dialogMap.get(id);
    if (dialogInfo) {
      const message = `Dialog with id of '${id}' already opened`;
      Logger.logInfo(UiFramework.loggerCategory(this), `openDialog: ${message}`);
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, message, undefined, OutputMessageType.Toast));
      return;
    }
    ContentDialogManager._dialogMap.set(id, { reactNode: dialog, zIndex: ++ContentDialogManager._topZIndex, parentDocument });
    ContentDialogManager._idArray.push(id);
    ContentDialogManager.dialogManager.openDialog(dialog, id, parentDocument);
  }

  /** Close a modeless dialog
   * @param id The id of the Dialog to close.
   */
  public static closeDialog(id: string): void {
    const dialogInfo = ContentDialogManager._dialogMap.get(id);
    if (dialogInfo) {
      ContentDialogManager.dialogManager.removeDialog(dialogInfo.reactNode);
      ContentDialogManager._dialogMap.delete(id);
      const index = ContentDialogManager._idArray.indexOf(id);
      // istanbul ignore else
      if (index >= 0)
        ContentDialogManager._idArray.splice(index, 1);

      if (ContentDialogManager.activeDialog === undefined)
        ContentDialogManager._topZIndex = ContentDialogManager.getDialogZIndexDefault();

      this.update();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `closeDialog: Could not find dialog with id of '${id}'`);
    }
  }

  /** @internal */
  public static closeAll(): void {
    ContentDialogManager.dialogManager.closeAll();
  }

  /** Update the dialogs */
  public static update(): void {
    ContentDialogManager.dialogManager.update();
  }

  /** Get the active modeless dialog */
  public static get activeDialog(): React.ReactNode | undefined {
    if (ContentDialogManager._idArray.length > 0) {
      const id = ContentDialogManager._idArray[ContentDialogManager._idArray.length - 1];
      const dialogInfo = ContentDialogManager._dialogMap.get(id);
      // istanbul ignore else
      if (dialogInfo)
        return dialogInfo.reactNode;
    }

    return undefined;
  }

  /** Get the count of modeless dialogs */
  public static get dialogCount(): number {
    return ContentDialogManager.dialogManager.dialogCount;
  }

  /** Handle a pointer down event on a modeless dialog */
  public static handlePointerDownEvent(_event: React.PointerEvent, id: string, updateFunc: () => void): void {
    const dialogInfo = ContentDialogManager._dialogMap.get(id);
    if (dialogInfo && dialogInfo.reactNode !== ContentDialogManager.activeDialog) {
      dialogInfo.zIndex = ++ContentDialogManager._topZIndex;

      ContentDialogManager._idArray.splice(ContentDialogManager._idArray.indexOf(id), 1);
      ContentDialogManager._idArray.push(id);

      updateFunc();
      this.update();
    }
  }

  /** Get the z-index for a modeless dialog */
  public static getDialogZIndex(id: string): number {
    let zIndex = ContentDialogManager.getDialogZIndexDefault();
    const dialogInfo = ContentDialogManager._dialogMap.get(id);
    // istanbul ignore else
    if (dialogInfo)
      zIndex = dialogInfo.zIndex;
    return zIndex;
  }

  public static getDialogInfo(id: string): ContentDialogInfo | undefined {
    return ContentDialogManager._dialogMap.get(id);
  }
}

/** ContentDialogRenderer React component renders modeless dialogs.
 * @public
 */
export class ContentDialogRenderer extends React.PureComponent<CommonProps> {

  constructor(props: CommonProps) {
    super(props);
  }

  public override render(): React.ReactNode {
    return (
      <DialogRendererBase {...this.props} dialogManager={ContentDialogManager.dialogManager} />
    );
  }
}
