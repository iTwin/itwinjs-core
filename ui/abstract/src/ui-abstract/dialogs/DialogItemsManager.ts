/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import { BaseDialogItem, DialogItem, DialogPropertySyncItem } from "./DialogItem";
import { PropertyEditorParams, PropertyEditorParamTypes, SuppressLabelEditorParams } from "../properties/EditorParams";
import { PropertyRecord } from "../properties/Record";
import { PropertyValueFormat, PrimitiveValue } from "../properties/Value";
import { UiDataProvider } from "./UiDataProvider";

/** DialogRow is the interface that groups dialog items into rows for building UI
 * @beta
 */
export interface DialogRow {
  priority: number;
  items: DialogItem[];
}
/** Arguments of [[DialogItemsManager.onChanged]] event.
 * @beta
 */
export interface DialogItemsChangedArgs {
  readonly items: ReadonlyArray<DialogPropertySyncItem>;
}

/** Interface to sync items
 * @beta
 */
export interface DialogItemSyncArgs {
  readonly items: ReadonlyArray<DialogPropertySyncItem>;
}

/** Items manager to generate UI items for Dialogs
 * @beta
 */
export class DialogItemsManager extends UiDataProvider {
  private _items: ReadonlyArray<DialogItem> = [];

  /** Array of dialog rows */
  public rows: DialogRow[] = [];

  /** Applies a property change */
  // istanbul ignore next
  public applyUiPropertyChange = (_item: DialogPropertySyncItem): void => { };

  /** Determines if this items manager is for the Tool Settings */
  public isToolSettingsManager = (): boolean => {
    return false;
  }

  constructor(items?: ReadonlyArray<DialogItem>) {
    super();
    // istanbul ignore else
    if (items)
      this.loadItemsInternal(items);
  }

  private loadItemsInternal(items: ReadonlyArray<DialogItem>) {
    this._items = items;
    this.rows = this.layoutDialogRows();
    // istanbul ignore else
  }

  /** Array of dialog items */
  public get items(): ReadonlyArray<DialogItem> {
    return this._items;
  }

  public set items(items: ReadonlyArray<DialogItem>) {
    // istanbul ignore else
    if (items !== this._items)
      this.loadItemsInternal(items);
  }

  /**
   * @internal
   */
  public layoutDialogRows(): DialogRow[] {
    const rows: DialogRow[] = [];

    this._items.forEach((item) => {
      // istanbul ignore else

      const row = rows.find((value) => value.priority === item.editorPosition.rowPriority);
      if (row) {
        row.items.push(item);
      } else {
        rows.push({ priority: item.editorPosition.rowPriority, items: [item] });
      }
    });

    // sort rows
    rows.sort((a: DialogRow, b: DialogRow) => a.priority - b.priority);
    // sort records
    rows.forEach((row: DialogRow) => row.items.sort((a: DialogItem, b: DialogItem) => a.editorPosition.columnIndex - b.editorPosition.columnIndex));
    return rows;
  }

  /** Determines if a dialog item editor wants a label */
  public static editorWantsLabel(item: DialogItem): boolean {
    if (item.property.editor && item.property.editor.params) {
      const params = item.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.SuppressEditorLabel) as SuppressLabelEditorParams;
      // istanbul ignore else
      if (params)
        return false;
    }
    return true;
  }

  /** Determines if a dialog items has an associated lock property */
  public static hasAssociatedLockProperty(item: DialogItem): boolean {
    return !!item.lockProperty;
  }

  /** Gets the disabled state for a given dialog item */
  public static getItemDisabledState(baseDialogItem: BaseDialogItem): boolean {
    const dialogItem = baseDialogItem as DialogItem;
    // istanbul ignore else
    if (dialogItem === undefined || dialogItem.lockProperty === undefined)
      return !!baseDialogItem.isDisabled;
    const value = dialogItem.lockProperty.value;
    // istanbul ignore next
    if (value === undefined)
      return !!baseDialogItem.isDisabled;

    return !value.value as boolean;
  }

  /** Gets a property record for a given dialog item */
  public static getPropertyRecord = (dialogItem: BaseDialogItem): PropertyRecord => {
    const propertyValue = { valueFormat: PropertyValueFormat.Primitive, value: dialogItem.value.value, displayValue: dialogItem.value.displayValue };
    const record = new PropertyRecord(propertyValue as PrimitiveValue, dialogItem.property);
    record.isDisabled = DialogItemsManager.getItemDisabledState(dialogItem);
    return record;
  }

  /** Determines if a dialog row only contains button group editors */
  public static onlyContainButtonGroupEditors(row: DialogRow): boolean {
    for (const item of row.items) {
      // istanbul ignore else
      if (DialogItemsManager.hasAssociatedLockProperty(item) || undefined === item.property.editor || "enum-buttongroup" !== item.property.editor.name || DialogItemsManager.editorWantsLabel(item))
        return false;
    }
    return true;
  }

}
