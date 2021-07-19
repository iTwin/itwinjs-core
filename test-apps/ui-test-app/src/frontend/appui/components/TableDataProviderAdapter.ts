/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Column,
} from "react-table";
import {
  CellItem,
  RowItem,
  TableDataProvider,
  TypeConverterManager,
} from "@bentley/ui-components";
import { PropertyValueFormat } from "@bentley/ui-abstract";

/**
 * Adapts [[TableDataProvider]] data for use by react-table
 */
export class TableDataProviderAdapter {
  private _dataProvider: TableDataProvider;
  private _tableData: Array<Record<string, unknown>> = [];
  private _tableColumns: Array<Column<Record<string, unknown>>> = [];

  constructor(dataProvider: TableDataProvider) {
    this._dataProvider = dataProvider;
  }

  public async getRowsCount(): Promise<number> {
    return this._dataProvider.getRowsCount();
  }

  public async adaptRows(): Promise<void> {
    this._tableData.length = 0;
    const rowCount = await this._dataProvider.getRowsCount();
    for (let index = 0; index < rowCount; index++) {
      const rowItem = await this._dataProvider.getRow(index);
      this._tableData.push(rowItem);
    }
  }

  public async adaptColumns(): Promise<void> {
    this._tableColumns.length = 0;
    const rowColumns = await this._dataProvider.getColumns();
    for (const rowColumn of rowColumns) {
      this._tableColumns.push({
        Header: rowColumn.label,
        accessor: (originalRow: any) => this._cellAccessor(originalRow as RowItem, rowColumn.key),
        id: rowColumn.key,
      });
    }
  }

  public async adapt(): Promise<void> {
    await this.adaptRows();
    await this.adaptColumns();
  }

  private _cellAccessor = (rowItem: RowItem, colKey: string): string => {
    const foundItem = rowItem.cells.find((cellItem) => cellItem.key === colKey);
    if (foundItem)
      return this.getCellDisplayValue(foundItem);
    return "";
  };

  private getCellDisplayValue(cellItem: CellItem): string {
    if (!cellItem.record || cellItem.record.value.valueFormat !== PropertyValueFormat.Primitive)
      return "";

    const value = cellItem.record.value.value;

    if (value === undefined)
      return "";

    const displayValue = TypeConverterManager
      .getConverter(cellItem.record.property.typename, cellItem.record.property.converter?.name)
      .convertPropertyToString(cellItem.record.property, value);

    if (displayValue) {
      if (typeof displayValue === "string")
        return displayValue;
      else
        return "* Promise unsupported"; // NEEDSWORK
    }

    return "";
  }

  public get reactTableData(): Array<Record<string, unknown>> {
    return this._tableData;
  }

  public get reactTableColumns(): Array<Column<Record<string, unknown>>> {
    return this._tableColumns;
  }
}
