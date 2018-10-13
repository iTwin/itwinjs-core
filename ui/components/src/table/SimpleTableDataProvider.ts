/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

import { SortDirection } from "@bentley/ui-core";
import { MutableTableDataProvider, ColumnDescription, RowItem, TableDataChangeEvent } from "./TableDataProvider";
import { PropertyRecord } from "../properties/Record";
import { PropertyValueFormat } from "../properties/Value";
import { TypeConverterManager } from "../converters/TypeConverterManager";

/**
 * A Table Data Provider using an array of items.
 */
export class SimpleTableDataProvider implements MutableTableDataProvider {
  private _items: RowItem[];
  private _rowItemIndices: number[];     // Used for both filtering and sorting
  private _columns: ColumnDescription[];
  private _secondarySortColumnStack: number[];
  public onColumnsChanged = new TableDataChangeEvent();
  public onRowsChanged = new TableDataChangeEvent();

  constructor(columns: ColumnDescription[]) {
    this._columns = columns;
    this._items = [];
    this._rowItemIndices = [];
    this._secondarySortColumnStack = [];
  }

  public setItems(items: RowItem[]): void {
    this._items = items;
    this._rowItemIndices = [];
    this.resetRowIndices();
    this.onRowsChanged.raiseEvent();
  }

  private resetRowIndices(): void {
    this._rowItemIndices.splice(0);

    for (let rowIndex = 0; rowIndex < this._items.length; rowIndex++) {
      this._rowItemIndices.push(rowIndex);
    }
  }

  public getColumns(): Promise<ColumnDescription[]> {
    return Promise.resolve(this._columns);
  }

  public getRowsCount(): Promise<number> {
    return Promise.resolve(this._items.length);
  }

  public async getRow(rowIndex: number, unfiltered?: boolean): Promise<RowItem> {
    let realRowIndex: number = -1;

    if (unfiltered) {
      if (0 <= rowIndex && rowIndex < this._items.length)
        realRowIndex = rowIndex;
    } else {
      if (0 <= rowIndex && rowIndex < this._rowItemIndices.length)
        realRowIndex = this.getRowIndexFromFilteredRowIndex(rowIndex);
    }

    if (0 <= realRowIndex && realRowIndex < this._items.length)
      return this._items[realRowIndex];

    throw new Error("Invalid row index");
  }

  private getRowIndexFromFilteredRowIndex(filteredRowIndex: number): number {
    if (filteredRowIndex === undefined)
      return filteredRowIndex;

    if (filteredRowIndex < 0 || filteredRowIndex >= this._rowItemIndices.length)
      return -1;

    return this._rowItemIndices[filteredRowIndex];
  }

  public async sort(columnIndex: number, sortDirection: SortDirection): Promise<void> {
    if (sortDirection === SortDirection.NoSort) {
      this.resetRowIndices();
      return;
    }

    this._secondarySortColumnStack = [];
    this._secondarySortColumnStack.push(columnIndex);

    // Sort by the column
    const dataProvider = this;
    this._rowItemIndices.sort((a: number, b: number) => {
      return dataProvider.sortDispatcher(dataProvider._items[a], dataProvider._items[b], columnIndex, sortDirection);
    });

    delete this._secondarySortColumnStack;

    return;
  }

  private sortDispatcher(a: RowItem, b: RowItem, columnIndex: number, sortDirection: SortDirection): number {
    let result = this.sortRows(a, b, columnIndex, sortDirection);

    if (result !== 0)
      return result;

    // Secondary sort column support
    const column = this._columns[columnIndex];
    if (column.secondarySortColumn !== undefined &&
      column.secondarySortColumn !== columnIndex &&
      this._secondarySortColumnStack.indexOf(column.secondarySortColumn) < 0) {

      this._secondarySortColumnStack.push(column.secondarySortColumn);
      result = this.sortDispatcher(a, b, column.secondarySortColumn, sortDirection);
      this._secondarySortColumnStack.pop();
    }

    return result;
  }

  private getPrimitiveValue(record: PropertyRecord): any {
    let primitiveValue: any;
    const recordValue = record.value;
    if (recordValue.valueFormat === PropertyValueFormat.Primitive)
      primitiveValue = recordValue.value;
    return primitiveValue;
  }

  private sortRows(a: RowItem, b: RowItem, columnIndex: number, sortDirection: SortDirection): number {
    const aCell = a.cells[columnIndex];
    const bCell = b.cells[columnIndex];

    let result: number = 0;
    const column = this._columns[columnIndex];

    const propertyDescription = column.propertyDescription;
    const valueA = this.getPrimitiveValue(aCell.record as PropertyRecord);
    const valueB = this.getPrimitiveValue(bCell.record as PropertyRecord);
    if (valueA && valueB && propertyDescription)
      result = TypeConverterManager.getConverter(propertyDescription.typename).sortCompare(valueA, valueB, column.sortIgnoreCase);

    if (sortDirection === SortDirection.Descending)
      result *= -1;

    return result;
  }

  public addRow(rowItem: RowItem): number {
    return this.insertRow(rowItem, -1);
  }

  public insertRow(rowItem: RowItem, index: number): number {
    let newIdx = index;

    if (index < 0 || index >= this._items.length)
      newIdx = this._items.push(rowItem) - 1;
    else
      this._items.splice(newIdx, 0, rowItem);

    this.resetRowIndices();
    this.onRowsChanged.raiseEvent();

    return newIdx;
  }

  public deleteRow(rowItem: RowItem, raiseRowsChangedEvent: boolean = true): void {
    const rowIndex = this.findRowIndex(rowItem);
    if (rowIndex >= 0) {
      this._items.splice(rowIndex, 1);

      this.resetRowIndices();
    }
    if (raiseRowsChangedEvent)
      this.onRowsChanged.raiseEvent();
  }

  public moveRow(rowItem: RowItem, newIndex: number): number {
    const oldIndex = this.findRowIndex(rowItem);
    if (oldIndex >= 0) {
      this.deleteRow(rowItem, false);

      if (newIndex > oldIndex)
        newIndex--;     // removing the row will shrink the count by 1
    }

    return this.insertRow(rowItem, newIndex);
  }

  private findRowIndex(item: RowItem): number {
    for (let i = 0; i < this._items.length; i++) {
      if (item === this._items[i])
        return i;
    }
    return -1;
  }
}
