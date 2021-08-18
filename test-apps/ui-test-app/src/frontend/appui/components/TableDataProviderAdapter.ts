/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Column } from "react-table";
import { CellItem, RowItem, TableDataProvider, TypeConverterManager} from "@bentley/ui-components";
import { PropertyValueFormat } from "@bentley/ui-abstract";

/**
 * Adapts TableDataProvider data for use by iTwinUI-react Table & react-table
 */
export class TableDataProviderAdapter {
  private _dataProvider: TableDataProvider;
  private _tableData: Record<string, unknown>[] = [];
  private _tableColumns: Column<Record<string, unknown>>[] = [];
  private _adaptedRowsCount = 0;

  constructor(dataProvider: TableDataProvider) {
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
        const displayValue = await this._cellAccessor(rowItem, column.key);
        cellProps[column.key] = displayValue;
      }
      this._tableData.push(cellProps);
    }

    this._adaptedRowsCount = realEnd;
  }

  public async adaptColumns(): Promise<void> {
    this._tableColumns.length = 0;
    const columns = await this._dataProvider.getColumns();
    for (const column of columns) {
      this._tableColumns.push({
        Header: column.label,
        accessor: column.key,
        id: column.key,
        maxWidth: column.width !== undefined ? column.width : undefined,
      });
    }
  }

  private _cellAccessor = async (rowItem: RowItem, colKey: string): Promise<string> => {
    const foundItem = rowItem.cells.find((cellItem) => cellItem.key === colKey);
    if (foundItem)
      return this.getCellDisplayValue(foundItem);
    return "";
  };

  private async getCellDisplayValue(cellItem: CellItem): Promise<string> {
    if (!cellItem.record || cellItem.record.value.valueFormat !== PropertyValueFormat.Primitive)
      return "";

    const value = cellItem.record.value.value;

    if (value === undefined)
      return "";

    const displayValue = TypeConverterManager
      .getConverter(cellItem.record.property.typename, cellItem.record.property.converter?.name)
      .convertPropertyToString(cellItem.record.property, value);

    return displayValue ? displayValue : /* istanbul ignore next */ "";
  }

  public get reactTableData(): Record<string, unknown>[] {
    return this._tableData;
  }

  public get reactTableColumns(): Column<Record<string, unknown>>[] {
    return this._tableColumns;
  }
}
