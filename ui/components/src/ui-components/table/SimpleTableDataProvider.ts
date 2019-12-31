/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

import { UiError } from "@bentley/ui-abstract";
import { SortDirection } from "@bentley/ui-core";
import { Primitives, PropertyRecord, PropertyValueFormat, PrimitiveValue } from "@bentley/imodeljs-frontend";

import { MutableTableDataProvider, ColumnDescription, RowItem, TableDataChangeEvent, TableDistinctValue } from "./TableDataProvider";
import { TypeConverterManager } from "../converters/TypeConverterManager";
import { UiComponents } from "../UiComponents";
import { DistinctValueCollection, CompositeFilterDescriptorCollection } from "./columnfiltering/ColumnFiltering";

/**
 * A Table Data Provider using an array of items.
 * @beta
 */
export class SimpleTableDataProvider implements MutableTableDataProvider {
  private _items: RowItem[];
  private _rowItemIndices: number[];     // Used for both filtering and sorting
  private _columns: ColumnDescription[];
  private _secondarySortColumnStack: number[];
  private _sortDirection: SortDirection = SortDirection.NoSort;
  private _sortColumnIndex: number = -1;
  private _filterDescriptors?: CompositeFilterDescriptorCollection;

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

  public async getColumns(): Promise<ColumnDescription[]> {
    return Promise.resolve(this._columns);
  }

  public async getRowsCount(): Promise<number> {
    return Promise.resolve(this._rowItemIndices.length);
  }

  public async getRow(rowIndex: number, unfiltered?: boolean): Promise<RowItem> {
    let realRowIndex: number = -1;

    if (unfiltered) {
      // istanbul ignore else
      if (0 <= rowIndex && rowIndex < this._items.length)
        realRowIndex = rowIndex;
    } else {
      if (0 <= rowIndex && rowIndex < this._rowItemIndices.length)
        realRowIndex = this.getRowIndexFromFilteredRowIndex(rowIndex);
    }

    if (0 <= realRowIndex && realRowIndex < this._items.length)
      return this._items[realRowIndex];

    throw new UiError(UiComponents.loggerCategory(this), `getRow: Invalid row index - ${rowIndex}`);
  }

  private getRowIndexFromFilteredRowIndex(filteredRowIndex: number): number {
    // istanbul ignore next
    if (filteredRowIndex === undefined)
      return filteredRowIndex;

    // istanbul ignore next
    if (filteredRowIndex < 0 || filteredRowIndex >= this._rowItemIndices.length)
      return -1;

    return this._rowItemIndices[filteredRowIndex];
  }

  public async sort(columnIndex: number, sortDirection: SortDirection): Promise<void> {
    // istanbul ignore next
    if (columnIndex < 0 || columnIndex >= this._columns.length)
      return;

    this._sortColumnIndex = columnIndex;
    this._sortDirection = sortDirection;

    if (sortDirection === SortDirection.NoSort) {
      if (this._filterDescriptors)
        await this.applyFilterDescriptors(this._filterDescriptors);
      else
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
    // istanbul ignore else
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

  private getPrimitiveValue(record: PropertyRecord) {
    let primitiveValue: Primitives.Value | undefined;
    const recordValue = record.value;
    // istanbul ignore else
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
    // istanbul ignore else
    if (valueA !== undefined && valueB !== undefined && propertyDescription)
      result = TypeConverterManager.getConverter(propertyDescription.typename).sortCompare(valueA, valueB, column.sortIgnoreCase);

    if (sortDirection === SortDirection.Descending)
      result *= -1;

    return result;
  }

  /** @alpha */
  public async getDistinctValues(columnKey: string, maximumValueCount?: number): Promise<DistinctValueCollection> {
    const distinctValues = new DistinctValueCollection();
    const columnIndex = this._columns.findIndex((description: ColumnDescription) => description.key === columnKey);
    if (columnIndex < 0 || columnIndex >= this._columns.length)
      return distinctValues;

    const columnDescription = this._columns[columnIndex];
    const propertyDescription = columnDescription.propertyDescription;
    const uniqueKeysMap: { [key: string]: TableDistinctValue } = {};
    const uniqueValues: any[] = [];

    // istanbul ignore next
    if (!propertyDescription)
      return distinctValues;

    this._items.forEach((row: RowItem) => {
      const cell = row.cells[columnIndex];
      const record = cell.record;

      // istanbul ignore next
      if (record === undefined)
        return;

      const value = this.getPrimitiveValue(record);
      const displayValue = TypeConverterManager.getConverter(propertyDescription.typename).convertPropertyToString(propertyDescription, value);

      // istanbul ignore next
      if (value === undefined || typeof displayValue !== "string")
        return;

      const valueKey = value.toString();
      if (!uniqueKeysMap.hasOwnProperty(valueKey)) {
        const propertyValue: TableDistinctValue = { value, label: displayValue };

        uniqueKeysMap[valueKey] = propertyValue;
        uniqueValues.push(propertyValue);
      }
    });

    distinctValues.values = uniqueValues;

    distinctValues.values.sort((a: PrimitiveValue, b: PrimitiveValue) => {
      if (a.value && b.value)
        return TypeConverterManager.getConverter(propertyDescription.typename).sortCompare(a.value, b.value);
      return 0;
    });

    if (maximumValueCount !== undefined && distinctValues.values.length > maximumValueCount)
      distinctValues.values.splice(maximumValueCount);

    return distinctValues;
  }

  /** @alpha */
  public async applyFilterDescriptors(filterDescriptors: CompositeFilterDescriptorCollection): Promise<void> {
    this._filterDescriptors = filterDescriptors;

    this._rowItemIndices.splice(0);

    this._items.forEach((row: RowItem, i: number) => {
      if (filterDescriptors.evaluateRow(row))
        this._rowItemIndices.push(i);
    });

    if (this._sortDirection !== SortDirection.NoSort) {
      await this.sort(this._sortColumnIndex, this._sortDirection);
    }
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
