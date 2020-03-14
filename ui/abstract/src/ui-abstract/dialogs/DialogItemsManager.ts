/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import { DialogItem, DialogPropertySyncItem, DialogItemValue } from "./DialogItem";
import { PropertyEditorParams, PropertyEditorParamTypes, SuppressLabelEditorParams} from "../properties/EditorParams";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "../properties/Record";
import { PropertyValueFormat, PrimitiveValue } from "../properties/Value";

/** DialogRow is the interface that groups dialog items into rows for building UI
 * @beta
 */
export interface DialogRow {
  priority: number;
  records: DialogItem[];
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
export class DialogItemsManager  {
  private _items: ReadonlyArray<DialogItem> = [];
  public rows: DialogRow[] = [];
  public valueMap = new Map<string, DialogItem>();  // allows easy lookup of record given the property name
  /** Event raised when the list of dialog items has changed */
  public readonly onItemsChanged = new BeUiEvent<(args: DialogItemsChangedArgs) => void>();
  public readonly onPropertiesChanged = new BeUiEvent<DialogItemSyncArgs>();
  public readonly onDataChanged = new BeUiEvent<DialogPropertySyncItem>();
  // istanbul ignore next
  public applyUiPropertyChange = (_item: DialogPropertySyncItem): void => {};
  constructor (items?: ReadonlyArray<DialogItem>) {
    // istanbul ignore else
    if (items) {
      this.loadItemsInternal (items, false);
      this.layoutDialogRows();
    }
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
      this.valueMap.set(item.property.name, item);
    // istanbul ignore else
      if (item.lockProperty)
        this.valueMap.set(item.lockProperty.property.name, item.lockProperty as DialogItem);

      const row = this.rows.find((value) => value.priority === item.editorPosition.rowPriority);
      if (row) {
        row.records.push(item);
      } else {
        this.rows.push({priority: item.editorPosition.rowPriority, records: [item]});
      }
    });

    // sort rows
    this.rows.sort((a: DialogRow, b: DialogRow) => a.priority - b.priority);
    // sort records
    this.rows.forEach((row: DialogRow) => row.records.sort((a: DialogItem, b: DialogItem) => a.editorPosition.columnIndex - b.editorPosition.columnIndex));
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

  public static getPropertyRecord = (dialogItem: DialogItem): PropertyRecord => {
    const propertyValue = { valueFormat: PropertyValueFormat.Primitive, value: dialogItem.value.value, displayValue: dialogItem.value.displayValue };
    const record = new PropertyRecord(propertyValue as PrimitiveValue, dialogItem.property);
    record.isDisabled = !!dialogItem.isDisabled;
    return record;
  }

  public static onlyContainButtonGroupEditors(row: DialogRow): boolean {
    for (const record of row.records) {
      // istanbul ignore else
      if (DialogItemsManager.hasAssociatedLockProperty(record) || undefined === record.property.editor || "enum-buttongroup" !== record.property.editor.name || DialogItemsManager.editorWantsLabel(record))
        return false;
    }
    return true;
  }

  /* istanbul ignore next */
  public execute(): void {
  }

}
