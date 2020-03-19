/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import { BaseDialogItem, DialogItem, DialogPropertySyncItem, DialogItemValue } from "./DialogItem";
import { PropertyEditorParams, PropertyEditorParamTypes, SuppressLabelEditorParams} from "../properties/EditorParams";
import { BeUiEvent } from "@bentley/bentleyjs-core";
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

/**  */
/** Items manager to generate UI items for Dialogs
 * @beta
 */
export class DialogItemsManager extends  UiDataProvider {
  private _items: ReadonlyArray<DialogItem> = [];
  public rows: DialogRow[] = [];
  public valueMap = new Map<string, PropertyRecord>();  // allows easy lookup of record given the property name
  /** Event raised when the list of dialog items has changed */
  public readonly onItemsChanged = new BeUiEvent<(args: DialogItemsChangedArgs) => void>();
  public readonly onPropertiesChanged = new BeUiEvent<DialogItemSyncArgs>();
  public readonly onDataChanged = new BeUiEvent<DialogPropertySyncItem>();
  // istanbul ignore next
  public applyUiPropertyChange = (_item: DialogPropertySyncItem): void => {};
  public isToolSettingsManager = (): boolean => {
    return false;
  }
  constructor (items?: ReadonlyArray<DialogItem>) {
    super ();
    // istanbul ignore else
    if (items)
      this.loadItemsInternal (items, false);

    this.onPropertiesChanged.addListener(this.updateItemProperties);
  }
  private loadItemsInternal(items: ReadonlyArray<DialogItem>, sendItemChanged: boolean) {
    this._items = items;
    this.layoutDialogRows();
    // istanbul ignore else
    if (sendItemChanged) {
      this.onItemsChanged.raiseEvent({ items });
    }
  }

  public get items(): ReadonlyArray<DialogItem> {
    return this._items;
  }

  public set items( items: ReadonlyArray<DialogItem>) {
    // istanbul ignore else
    if (items !== this._items)
      this.loadItemsInternal (items, true);
  }

  public updateItemProperties = (syncItems: DialogItemSyncArgs): void => {
    const newItems: DialogItem[] = [];
    this._items.forEach((item) => {
      const updateItem = syncItems.items.find ((syncItem) => item.property.name === syncItem.propertyName);
      if (updateItem === undefined) {
        newItems.push(item);
      } else {
        const updatedIsDisabled = item.isDisabled === updateItem.isDisabled ? item.isDisabled : updateItem.isDisabled;
        const updatedValue: DialogItemValue = item.value === updateItem.value ? item.value : updateItem.value;
        const newItem: DialogItem = {value: updatedValue, property: item.property, editorPosition: item.editorPosition, isDisabled: updatedIsDisabled, lockProperty: item.lockProperty};
        newItems.push(newItem);
      }
    });
    this.loadItemsInternal (newItems, false);
  }

  public layoutDialogRows(): boolean {

    this.rows = [];
    this._items.forEach((item) => {
      const record  = DialogItemsManager.getPropertyRecord(item);
      this.valueMap.set(item.property.name, record);
    // istanbul ignore else
      if (item.lockProperty) {
        const lockRecord = DialogItemsManager.getPropertyRecord(item.lockProperty as DialogItem);
        this.valueMap.set(item.lockProperty.property.name, lockRecord);
      }

      const row = this.rows.find((value) => value.priority === item.editorPosition.rowPriority);
      if (row) {
        row.items.push(item);
      } else {
        this.rows.push({priority: item.editorPosition.rowPriority, items: [item]});
      }
    });

    // sort rows
    this.rows.sort((a: DialogRow, b: DialogRow) => a.priority - b.priority);
    // sort records
    this.rows.forEach((row: DialogRow) => row.items.sort((a: DialogItem, b: DialogItem) => a.editorPosition.columnIndex - b.editorPosition.columnIndex));
    return this.rows.length > 0;
  }

  public static editorWantsLabel(item: DialogItem): boolean {
    if (item.property.editor && item.property.editor.params) {
      const params = item.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.SuppressEditorLabel) as SuppressLabelEditorParams;
      // istanbul ignore else
      if (params)
        return false;
    }
    return true;
  }

  public static hasAssociatedLockProperty(item: DialogItem): boolean {
    return !!item.lockProperty;
  }

  public static getItemDisabledState (baseDialogItem: BaseDialogItem): boolean {
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
  public static getPropertyRecord = (dialogItem: BaseDialogItem): PropertyRecord => {
    const propertyValue = { valueFormat: PropertyValueFormat.Primitive, value: dialogItem.value.value, displayValue: dialogItem.value.displayValue };
    const record = new PropertyRecord(propertyValue as PrimitiveValue, dialogItem.property);
    record.isDisabled = DialogItemsManager.getItemDisabledState (dialogItem);
    return record;
  }

  public static onlyContainButtonGroupEditors(row: DialogRow): boolean {
    for (const item of row.items) {
      // istanbul ignore else
      if (DialogItemsManager.hasAssociatedLockProperty(item) || undefined === item.property.editor || "enum-buttongroup" !== item.property.editor.name || DialogItemsManager.editorWantsLabel(item))
        return false;
    }
    return true;
  }

}
