/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DialogChangedEvent, DialogInfo, DialogManagerBase } from "../dialog/DialogManagerBase";

/** Modal Dialog Changed Event class.
 * @public
 */
export class ModalDialogChangedEvent extends DialogChangedEvent { }

/** Modeless Dialog Changed Event class.
 * @public
 */
export class ModelessDialogChangedEvent extends DialogChangedEvent { }

/** @public */
export interface ModelessDialogInfo {
  reactNode: React.ReactNode;
  zIndex: number;
  parentDocument: Document;
}

/**
 * Manages dialog access
 * @beta
 */
export interface FrameworkDialog {
  /** @internal */
  readonly dialogManager: DialogManagerBase;

  /** Get the array of modal dialogs */
  readonly dialogs: DialogInfo[];

  /** Open a modal dialog
   * @param dialog The Dialog to open
   * @param id The id of the Dialog. If one is not provided, an id is generated.
   * @param parentDocument The Document used to determine the owning window.
   */
  openDialog(dialog: React.ReactNode, id?: string, parentDocument?: Document): void;

  /** Close a modal dialog
   * @param dialog The Dialog to open. If one is not specified, the active dialog will be closed.
   */
  closeDialog(dialog?: React.ReactNode): void;

  /** @internal */
  closeAll(): void;

  /** Update the dialogs */
  update(): void;

  /** Get the active modal dialog */
  readonly activeDialog: React.ReactNode | undefined;

  /** Get the count of modal dialogs */
  readonly dialogCount: number;
}

/**
 * FrameworkDialog that manages the top most content.
 * @beta
 */
export interface FrameworkStackedDialog<DialogInfoType> extends FrameworkDialog {
  /** Initialize the stacked dialog manager
   * @internal
  */
  initialize(): void;

  /** Handle a pointer down event on a modeless dialog */
  handlePointerDownEvent(_event: React.PointerEvent, id: string, updateFunc: () => void): void;

  /** Get the z-index for a modeless dialog */
  getDialogZIndex(id: string): number;

  getDialogInfo(id: string): DialogInfoType | undefined;
}

/**
 * [[UiFramework.dialogs]] interface.
 * @beta
 */
export interface FrameworkDialogs {
  /**
   * Manage modal dialogs.
   * @beta
   */
  modal: FrameworkDialog & {
    /** Modal Dialog Changed Event */
    readonly onModalDialogChangedEvent: ModalDialogChangedEvent;
  };

  /**
   * Manage modeless dialogs.
   * @beta
   */
  modeless: FrameworkStackedDialog<ModelessDialogInfo> & {
    /** Modeless Dialog Changed Event */
    readonly onModelessDialogChangedEvent: ModelessDialogChangedEvent;
  };
}
