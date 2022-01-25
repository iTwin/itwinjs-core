/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CellProps, Column } from "react-table";
import { Primitives, PropertyValueFormat } from "@itwin/appui-abstract";
import { CellItem, RowItem, TableDataProvider } from "@itwin/components-react";
import { ReactTableCell } from "./ReactTableCell";

/**
 * Adapts TableDataProvider data for use by iTwinUI-react Table & react-table
 */
export class TableDataProviderAdapter {
  private _dataProvider: TableDataProvider;
  private _tableData: Record<string, unknown>[] = [];
  private _tableColumns: Column<Record<string, unknown>>[] = [];
  private _adaptedRowsCount = 0;

  constructor(dataProvider: TableDataProvider, public useCellPropertyDescription?: boolean) {
    this._dataProvider = dataProvider;
  }

  public async getRowsCount(): Promise<number> {
    return this._dataProvider.getRowsCount();
  }

  public get adaptedRowsCount(): number { return this._adaptedRowsCount; }

  public clearAdaptedRows(): void {
    this._tableData.length = 0;
    this._adaptedRowsCount = 0;
  }

  public async adaptRows(end: number): Promise<void> {
    const rowsCount = await this._dataProvider.getRowsCount();
    const columns = await this._dataProvider.getColumns();

    if (this._adaptedRowsCount >= rowsCount)
      return;

    let realEnd = 0;
    if (end < 0)
      realEnd = rowsCount;
    else
      realEnd = Math.min(end, rowsCount);

    this._tableData = this._tableData.slice();

    for (let index = this._adaptedRowsCount; index < realEnd; index++) {
      const rowItem = await this._dataProvider.getRow(index);
      const cellProps: { [key: string]: any } = {};
      for (const column of columns) {
        const cellItem = this.getCellItem(rowItem, column.key);
        if (cellItem) {
          const value = this.getCellValue(cellItem);
          if (value !== undefined) {
            cellProps[column.key] = value;
          }
        }
      }
      this._tableData.push(cellProps);
    }

    this._adaptedRowsCount = realEnd;
  }

  public async adaptColumns(): Promise<void> {
    this._tableColumns.length = 0;
    const columns = await this._dataProvider.getColumns();
    for (const column of columns) {
      const propertyDescription = column.propertyDescription;
      this._tableColumns.push({
        Header: column.label,
        accessor: column.key,
        id: column.key,
        width: column.width ?? undefined,
        sortType: column.sortType ?? "alphanumeric",
        Cell: propertyDescription
          ? (props: CellProps<any>) => {
            return (
              <ReactTableCell
                tableDataProvider={this._dataProvider}
                columnProperty={propertyDescription}
                value={props.value}
                rowIndex={props.row.index}
                cellKey={props.cell.column.id}
                useCellPropertyDescription={this.useCellPropertyDescription}
              />
            );
          }
          : undefined,
      });
    }
  }

  private getCellItem(rowItem: RowItem, colKey: string): CellItem | undefined {
    return rowItem.cells.find((cellItem) => cellItem.key === colKey);
  }

  private getCellValue(cellItem: CellItem): Primitives.Value | undefined {
    if (!cellItem.record || cellItem.record.value.valueFormat !== PropertyValueFormat.Primitive)
      return undefined;

    return cellItem.record.value.value;
  }

  public get reactTableData(): Record<string, unknown>[] {
    return this._tableData;
  }

  public get reactTableColumns(): Column<Record<string, unknown>>[] {
    return this._tableColumns;
  }
}
