/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as _ from "lodash";
import * as React from "react";
import * as ReactDataGrid from "react-data-grid";
import { DisposableList } from "@bentley/bentleyjs-core";
import { SortDirection } from "@bentley/ui-core";
import { PropertyRecord } from "../../properties";
import { TableDataProvider, ColumnDescription, RowItem } from "../TableDataProvider";
import "./Grid.scss";

/** Props for the Table React component */
export interface TableProps {
  /** Data provider for the Table */
  dataProvider: TableDataProvider;
  /** Amount of rows per page */
  pageAmount?: number;

  /** Callback for determining if row selected */
  isRowSelected?: (row: RowItem) => boolean;
  /** Callback for when rows are selected */
  onRowsSelected?: (rows: RowItem[], replace: boolean) => boolean;
  /** Callback for when rows are deselected */
  onRowsDeselected?: (rows: RowItem[]) => boolean;
}

export interface TableState {
  selectedRowKeys: string[];
  columns: ReactDataGridColumn[];
  rows: TableRow[];
  rowsCount: number;
}

export interface ReactDataGridColumn {
  key: string;
  name: string;
  resizable?: boolean;
  sortable?: boolean;
}

export interface ReactDataGridRow {
  __key: string;
  [columnKey: string]: string | undefined;
}

export interface TableRow {
  row: ReactDataGridRow;
  item: RowItem;
}

const initialState: TableState = {
  selectedRowKeys: [],
  columns: [],
  rows: [],
  rowsCount: 0,
};

interface RowsLoadResult {
  rows: TableRow[];
  selectedKeys: string[];
}

/**
 * Table React component
 */
export class Table extends React.Component<TableProps, TableState> {

  private _pageAmount = 100;
  private _disposableListeners = new DisposableList();
  private _isMounted = false;

  public readonly state: Readonly<TableState> = initialState;

  constructor(props: TableProps, context?: any) {
    super(props, context);

    if (props.pageAmount)
      this._pageAmount = props.pageAmount;

    this._disposableListeners.add(props.dataProvider.onColumnsChanged.addListener(this.onColumnsChanged));
    this._disposableListeners.add(props.dataProvider.onRowsChanged.addListener(this.onRowsChanged));
  }

  public componentWillReceiveProps(_newProps: TableProps) {
    this.update();
  }

  public componentWillMount() {
    this._isMounted = true;
    this.update();
  }

  public componentWillUnmount() {
    this._isMounted = false;
    this._disposableListeners.dispose();
  }

  private async updateColumns() {
    const columnDescriptions = await this.props.dataProvider.getColumns();
    if (!this._isMounted)
      return;

    const columns = columnDescriptions.map(this.columnDescriptionToReactDataGridColumn);
    this.setState(() => {
      return {
        columns,
      };
    });
  }

  private onColumnsChanged = async () => {
    await this.updateColumns();
  }

  private async updateRows() {
    const rowsCount = await this.props.dataProvider.getRowsCount();
    if (!this._isMounted)
      return;

    this.rowGetterAsync.cache.clear();
    this.setState((prev: TableState) => ({
      ...prev,
      rowsCount,
    }));
    this.rowGetterAsync(0);
  }

  private onRowsChanged = async () => {
    await this.updateRows();
  }

  private async update() {
    await this.updateColumns();
    await this.updateRows();
  }

  public updateSelectedRows() {
    const selectedRowKeys = new Array<string>();
    if (this.props.isRowSelected) {
      this.state.rows.forEach((row) => {
        if (this.props.isRowSelected!(row.item))
          selectedRowKeys.push(row.row.__key);
      });
    }
    this.setState({ selectedRowKeys });
  }

  private columnDescriptionToReactDataGridColumn(columnDescription: ColumnDescription): ReactDataGridColumn {
    let label: string;
    if (columnDescription.propertyDescription !== undefined)
      label = columnDescription.propertyDescription.displayLabel;
    else if (columnDescription.label !== undefined)
      label = columnDescription.label;
    else
      label = "";

    return {
      key: columnDescription.key,
      name: label,
      resizable: columnDescription.resizable !== undefined ? columnDescription.resizable : false,
      sortable: columnDescription.sortable !== undefined ? columnDescription.sortable : false,
    };
  }

  private async cellRecordToString(record: PropertyRecord | string): Promise<string> {
    return (typeof record === "string") ? record : await record.getDisplayValue();
  }

  private async rowItemToReactGridRow(rowData: RowItem): Promise<ReactDataGridRow> {
    const gridRow: ReactDataGridRow = {
      __key: JSON.stringify(rowData.key),
    };
    if (rowData) {
      for (const cellItem of rowData.cells) {
        const cellKey = cellItem.key;
        const cellValue = cellItem.record ? await this.cellRecordToString(cellItem.record) : undefined;
        gridRow[cellKey] = cellValue;
      }
    }
    return gridRow;
  }

  private getRowItem(rowIndex: number): RowItem | undefined {
    const row = this.state.rows[rowIndex];
    return row ? row.item : undefined;
  }

  private rowGetter = (i: number): ReactDataGridRow => {
    if (this.state.rows[i])
      return this.state.rows[i].row;

    // get another page of rows
    // note: always start loading at the beginning of a page to avoid
    // requesting duplicate data (e.g. a page that starts at 0, at 1, at 2, ...)
    this.rowGetterAsync(i - (i % this._pageAmount));

    // Return placeholder object
    return { __key: "" };
  }

  private rowGetterAsync = _.memoize(async (index: number): Promise<void> => {
    if (index < 0)
      return;

    // load up to `this._pageAmount` more rows
    const maxIndex = Math.min(this.state.rowsCount, index + this._pageAmount);
    const loadResult = await this.loadRows(index, maxIndex);
    if (!this._isMounted)
      return;

    this.setState((prev) => {
      const rows = [...prev.rows];
      loadResult.rows.forEach((r, i) => { rows[index + i] = r; });
      const selectedRowKeys = [...prev.selectedRowKeys];
      loadResult.selectedKeys.forEach((k) => selectedRowKeys.push(k));
      return { rows, selectedRowKeys };
    });
  });

  private async loadRows(beginIndex: number, endIndex: number): Promise<RowsLoadResult> {
    const result: RowsLoadResult = {
      rows: [],
      selectedKeys: [],
    };
    for (let i = beginIndex; i < endIndex; ++i) {
      const rowData = await this.props.dataProvider.getRow(i);
      const gridRow = await this.rowItemToReactGridRow(rowData);
      result.rows.push({ row: gridRow, item: rowData });
      if (this.props.isRowSelected && this.props.isRowSelected(rowData))
        result.selectedKeys.push(gridRow.__key);
    }
    return result;
  }

  private handleGridSort = (columnKey: string, sortDirection: "ASC" | "DESC" | "NONE") => {
    let directionEnum: SortDirection;

    switch (sortDirection) {
      case "ASC":
        directionEnum = SortDirection.Ascending;
        break;
      case "DESC":
        directionEnum = SortDirection.Descending;
        break;
      case "NONE":
      default:
        directionEnum = SortDirection.NoSort;
        break;
    }

    // Sort the column
    this.gridSortAsync(columnKey, directionEnum);
  }

  private getColumnIndexFromKey(columnKey: string): number {
    let columnIndex: number = -1;

    for (let i = 0; i < this.state.columns.length; i++) {
      const column = this.state.columns[i];
      if (column.key === columnKey) {
        columnIndex = i;
        break;
      }
    }

    return columnIndex;
  }

  private async gridSortAsync(columnKey: string, directionEnum: SortDirection) {
    let columnIndex = this.getColumnIndexFromKey(columnKey);
    if (columnIndex < 0)
      return;

    for (let i = 0; i < this.state.columns.length; i++) {
      const column = this.state.columns[i];
      if (column.key === columnKey) {
        columnIndex = i;
        break;
      }
    }

    await this.props.dataProvider.sort(columnIndex, directionEnum);
    if (!this._isMounted)
      return;

    this.updateRows();
  }

  private onRowClick = (rowIdx: number, row: ReactDataGridRow) => {
    if (this.isRowSelected(row.__key))
      this.onRowsDeselected([{ rowIdx, row }]);
    else
      this.onRowsSelected([{ rowIdx, row }]);
  }

  private isRowSelected = (key: string): boolean => {
    return -1 !== this.state.selectedRowKeys.indexOf(key);
  }

  private getRowItems = (rows: ReactDataGrid.SelectionParams[]): RowItem[] => {
    return rows
      .map((r) => this.getRowItem(r.rowIdx))
      .filter((r) => (undefined !== r)) as RowItem[];
  }

  private onRowsSelected = (rows: ReactDataGrid.SelectionParams[]): void => {
    if (this.props.onRowsSelected && !this.props.onRowsSelected(this.getRowItems(rows), true))
      return;

    // wip: add or replace? for now just replace...
    // const selectedRowKeys = [...this.state.selectedRowKeys];
    const selectedRowKeys = new Array<string>();
    rows.forEach((r) => selectedRowKeys.push((r.row as ReactDataGridRow).__key));
    this.setState({ selectedRowKeys });
  }

  private onRowsDeselected = (rows: ReactDataGrid.SelectionParams[]): void => {
    if (this.props.onRowsDeselected && !this.props.onRowsDeselected(this.getRowItems(rows)))
      return;

    const keepSelected = (key: string): boolean => !rows.some((r) => ((r.row as ReactDataGridRow).__key === key));
    const selectedRowKeys = this.state.selectedRowKeys.filter((key) => keepSelected(key));
    this.setState({ selectedRowKeys });
  }

  public render() {
    return (
      <div className="react-data-grid-wrapper">
        <ReactDataGrid
          columns={this.state.columns}
          rowGetter={this.rowGetter}
          rowsCount={this.state.rowsCount}
          enableCellSelect={false}
          minHeight={500}
          headerRowHeight={25}
          rowHeight={25}
          rowSelection={{
            showCheckbox: false,
            enableShiftSelect: true,
            onRowsSelected: this.onRowsSelected,
            onRowsDeselected: this.onRowsDeselected,
            selectBy: {
              keys: { rowKey: "__key", values: this.state.selectedRowKeys },
            },
          }}
          onRowClick={(index, row) => this.onRowClick(index, row as ReactDataGridRow)}
          onGridSort={this.handleGridSort}
        />
      </div>
    );
  }
}
