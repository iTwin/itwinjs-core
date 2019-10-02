/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";

import { ToolSettingsPropertyItem } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";

/** Interface used by UiDataProvider class to send property value changes to UI.
 * @alpha
 */
export interface SyncPropertiesChangeEventArgs {
  properties: ToolSettingsPropertyItem[];
}

/** Status of Proposed property changes from UI to UiDataProvider
 * @alpha
 */
export enum PropertyChangeStatus {
  // Property Change(s) Succeeded
  Success = 0,
  // Error Processing Property Change(s)
  Error = 2,
}

/** Interface used by UiDataProvider to report change status (validation) to UI.
 * @alpha
 */
export interface PropertyChangeResult {
  errorMsg?: string;
  status: PropertyChangeStatus;
}

/** Sync Properties Change Event class. Defines event that is subscribed to by UI component to get property updates from API.
 * @alpha
 */
// istanbul ignore next
export class SyncPropertiesChangeEvent extends UiEvent<SyncPropertiesChangeEventArgs> { }

/** Abstract class that allow property values to be passed between hosting API and UI
 * @alpha
 */
// istanbul ignore next
export abstract class UiDataProvider {
  public onSyncPropertiesChangeEvent = new SyncPropertiesChangeEvent();

  /** Called to send property updates to UI
   * @internal
   */
  public syncPropertiesInUi(properties: ToolSettingsPropertyItem[]): void {
    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  /** Called by UI to inform data provider of changes. If used by modal dialog then this is typically only called
   * when "OK" or "Apply" button is selected.
   */
  public processChangesInUi(_properties: ToolSettingsPropertyItem[]): PropertyChangeResult {
    return { status: PropertyChangeStatus.Success };
  }

  /** Called by UI to request available properties. */
  public supplyAvailableProperties(): ToolSettingsPropertyItem[] {
    return [];
  }

  /** Called by UI to validate a property value */
  public validateProperty(_item: ToolSettingsPropertyItem): PropertyChangeResult {
    return { status: PropertyChangeStatus.Success };
  }
}

/** Dialog Stack Changed Event Args class.
 * @public
 */
export interface DialogChangedEventArgs {
  dialogCount: number;
  activeDialog: React.ReactNode | undefined;
}

/** Dialog Changed Event class.
 * @public
 */
export class DialogChangedEvent extends UiEvent<DialogChangedEventArgs> { }

/** Information maintained by a Dialog Manager about a dialog
 * @public
 */
export interface DialogInfo {
  reactNode: React.ReactNode;
  id: string;
}

/** Dialog Manager class.
 * @internal
 */
export class DialogManagerBase {
  private static _sId = 0;
  private _dialogs: DialogInfo[] = new Array<DialogInfo>();
  private _onDialogChangedEvent: DialogChangedEvent;

  constructor(onDialogChangedEvent: DialogChangedEvent) {
    this._onDialogChangedEvent = onDialogChangedEvent;
  }

  public get dialogs() { return this._dialogs; }

  public get onDialogChangedEvent(): DialogChangedEvent { return this._onDialogChangedEvent; }

  public openDialog(dialog: React.ReactNode, id?: string): void {
    if (!id)
      id = "Dialog-" + ++DialogManagerBase._sId;

    this.pushDialog({ reactNode: dialog, id });
  }

  /** @internal */
  public pushDialog(dialogInfo: DialogInfo): void {
    this._dialogs.push(dialogInfo);
    this.emitDialogChangedEvent();
  }

  public closeDialog(dialog?: React.ReactNode): void {
    let targetDialog = dialog;
    if (!dialog)
      targetDialog = this.activeDialog;

    this.removeDialog(targetDialog);
    this.emitDialogChangedEvent();
  }

  /** @internal */
  public removeDialog(dialog: React.ReactNode): void {
    const index = this._dialogs.findIndex((dialogInfo: DialogInfo) => {
      return dialog === dialogInfo.reactNode;
    });
    if (index >= 0)
      this._dialogs.splice(index, 1);
  }

  public emitDialogChangedEvent(): void {
    this._onDialogChangedEvent.emit({ dialogCount: this.dialogCount, activeDialog: this.activeDialog });
  }

  public update(): void {
    this.emitDialogChangedEvent();
  }

  public get activeDialog(): React.ReactNode | undefined {
    if (this._dialogs.length > 0)
      return this._dialogs[this._dialogs.length - 1].reactNode;

    return undefined;
  }

  public get dialogCount(): number {
    return this._dialogs.length;
  }
}

/** Properties for the [[DialogRendererBase]] component
 * @internal
 */
export interface DialogRendererProps {
  dialogManager: DialogManagerBase;
}

/** DialogRenderer React component.
 * @internal
 */
export class DialogRendererBase extends React.PureComponent<DialogRendererProps> {

  public render(): React.ReactNode {
    if (this.props.dialogManager.dialogCount <= 0)
      return null;

    return (
      <>
        {
          this.props.dialogManager.dialogs.map((dialogInfo: DialogInfo) => {
            return (
              <React.Fragment key={dialogInfo.id} >
                {dialogInfo.reactNode}
              </React.Fragment>
            );
          })
        }
      </>
    );
  }

  public componentDidMount(): void {
    this.props.dialogManager.onDialogChangedEvent.addListener(this._handleDialogChangedEvent);
  }

  public componentWillUnmount(): void {
    this.props.dialogManager.onDialogChangedEvent.removeListener(this._handleDialogChangedEvent);
  }

  private _handleDialogChangedEvent = (_args: DialogChangedEventArgs) => {
    this.forceUpdate();
  }

}
