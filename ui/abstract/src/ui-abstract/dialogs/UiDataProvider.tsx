/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import { ToolSettingsPropertyItem, ToolSettingsPropertySyncItem } from "../properties/ToolSettingsValue";
import { BeUiEvent } from "@bentley/bentleyjs-core";

/** Sync UI Control Properties Event class.
 * @beta
 */
export class SyncPropertiesChangeEvent extends BeUiEvent<SyncPropertiesChangeEventArgs> { }

/** Abstract class that allows property values to be passed between hosting API and UI
 * @beta
 */
// istanbul ignore next
export abstract class UiDataProvider {
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

  public onSyncPropertiesChangeEvent = new SyncPropertiesChangeEvent();

  /** Called by UI to validate a property value */
  public validateProperty(_item: ToolSettingsPropertyItem): PropertyChangeResult {
    return { status: PropertyChangeStatus.Success };
  }

}
/** Sync UI Control Properties Event Args interface.
 * @beta
 */
export interface SyncPropertiesChangeEventArgs {
  properties: ToolSettingsPropertySyncItem[];
}

/** Status of Proposed property changes from UI to UiDataProvider
 * @beta
 */
export enum PropertyChangeStatus {
  // Property Change(s) Succeeded
  Success = 0,
  // Error Processing Property Change(s)
  Error = 2,
}

/** Interface used by UiDataProvider to report change status (validation) to UI.
 * @beta
 */
export interface PropertyChangeResult {
  errorMsg?: string;
  status: PropertyChangeStatus;
}
