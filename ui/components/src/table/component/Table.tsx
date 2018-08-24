/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as _ from "lodash";
import * as React from "react";
import * as ReactDataGrid from "react-data-grid";
import { DisposableList, Guid } from "@bentley/bentleyjs-core";
import { SortDirection } from "@bentley/ui-core";
import { PropertyRecord } from "../../properties";
import { TableDataProvider, ColumnDescription, RowItem } from "../TableDataProvider";
import { withDropTarget, WithDropTargetProps, DragSourceArguments, DropTargetArguments, DragSourceProps, DropTargetProps } from "../../dragdrop";
import { DragDropRow } from "./DragDropRowRenderer";
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

  dragProps?: DragSourceProps;
  dropProps?: TableDropTargetProps;
}

/** Properties for the Table's DropTarget. */
export interface TableDropTargetProps extends DropTargetProps {
  /** Used for table components that allow dropping inside. Ie. [[BreadcrumbDetails]]. */
  canDropOn?: boolean;
}

interface TableState {
  selectedRowKeys: string[];
  columns: ReactDataGridColumn[];
  rows: TableRow[];
  rowsCount: number;
}

interface ReactDataGridColumn {
  key: string;
  name: string;
  formatter?: any;
  width?: number;
  resizable?: boolean;
  sortable?: boolean;
}

interface ReactDataGridRow {
  __key: string;
  [columnKey: string]: string | undefined;
}

interface TableRow {
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
  private _rowLoadGuid = new Guid(true);
  public readonly state: Readonly<TableState> = initialState;

  constructor(props: TableProps, context?: any) {
    super(props, context);

    if (props.pageAmount)
      this._pageAmount = props.pageAmount;

    this._disposableListeners.add(props.dataProvider.onColumnsChanged.addListener(this._onColumnsChanged));
    this._disposableListeners.add(props.dataProvider.onRowsChanged.addListener(this._onRowsChanged));
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

  private _onColumnsChanged = async () => {
    await this.updateColumns();
  }

  private async updateRows() {
    const rowsCount = await this.props.dataProvider.getRowsCount();
    if (!this._isMounted)
      return;

    this._rowGetterAsync.cache.clear();
    this.setState((prev: TableState) => ({
      ...prev,
      rowsCount,
    }));
    await this._rowGetterAsync(0);
  }

  private _onRowsChanged = async () => {
    await this.updateRows();
  }

  /** @hidden */
  public async update() {
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
      ...(columnDescription.icon ? {
        width: 32,
        formatter: IconCell,
      } : {}),
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

  private _rowGetter = (i: number): ReactDataGridRow => {
    if (this.state.rows[i])
      return this.state.rows[i].row;

    // get another page of rows
    // note: always start loading at the beginning of a page to avoid
    // requesting duplicate data (e.g. a page that starts at 0, at 1, at 2, ...)
    this._rowGetterAsync(i - (i % this._pageAmount));

    // Return placeholder object
    return { __key: "" };
  }

  private _rowGetterAsync = _.memoize(async (index: number): Promise<void> => {
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
    this._rowLoadGuid = new Guid(true);
    const currentSelectedRowGuid = new Guid(this._rowLoadGuid);

    const promises = new Array<Promise<TableRow>>();
    for (let i = beginIndex; i < endIndex; ++i) {
      promises.push(
        this.props.dataProvider.getRow(i).then((rowData) =>
          this.rowItemToReactGridRow(rowData).then((row) => ({ item: rowData, row })),
        ));
    }

    let rows: TableRow[] = [];
    const selectedKeys: string[] = [];

    try {
      rows = await Promise.all(promises);
    } catch { }

    // Check if another loadRows got called while this one was still going
    if (currentSelectedRowGuid.equals(this._rowLoadGuid)) {
      rows.forEach((row) => {
        if (this.props.isRowSelected && this.props.isRowSelected(row.item))
          selectedKeys.push(row.row.__key);
      });
    }

    return { rows, selectedKeys };
  }

  private _handleGridSort = (columnKey: string, sortDirection: "ASC" | "DESC" | "NONE") => {
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

  private _onRowClick = (rowIdx: number, row: ReactDataGridRow) => {
    if (this._isRowSelected(row.__key))
      this._onRowsDeselected([{ rowIdx, row }]);
    else
      this._onRowsSelected([{ rowIdx, row }]);
  }

  private _isRowSelected = (key: string): boolean => {
    return -1 !== this.state.selectedRowKeys.indexOf(key);
  }

  private _getRowItems = (rows: ReactDataGrid.SelectionParams[]): RowItem[] => {
    return rows
      .map((r) => this.getRowItem(r.rowIdx))
      .filter((r) => (undefined !== r)) as RowItem[];
  }

  private _onRowsSelected = (rows: ReactDataGrid.SelectionParams[]): void => {
    if (this.props.onRowsSelected && !this.props.onRowsSelected(this._getRowItems(rows), true))
      return;

    // wip: add or replace? for now just replace...
    // const selectedRowKeys = [...this.state.selectedRowKeys];
    const selectedRowKeys = new Array<string>();
    rows.forEach((r) => selectedRowKeys.push((r.row as ReactDataGridRow).__key));
    this.setState({ selectedRowKeys });
  }

  private _onRowsDeselected = (rows: ReactDataGrid.SelectionParams[]): void => {
    if (this.props.onRowsDeselected && !this.props.onRowsDeselected(this._getRowItems(rows)))
      return;

    const keepSelected = (key: string): boolean => !rows.some((r) => ((r.row as ReactDataGridRow).__key === key));
    const selectedRowKeys = this.state.selectedRowKeys.filter((key) => keepSelected(key));
    this.setState({ selectedRowKeys });
  }

  public render() {
    const { dragProps: drag, dropProps: drop } = this.props;
    if ((drag && (drag.onDragSourceBegin || drag.onDragSourceEnd)) ||
      (drop && (drop.onDropTargetOver || drop.onDropTargetDrop))) {
      // tslint:disable-next-line:variable-name
      const DragDropWrapper =
        withDropTarget(class extends React.Component<React.HTMLAttributes<HTMLDivElement>> {
          public render(): React.ReactNode {
            const { isOver, canDrop, item, type, ...props } = this.props as WithDropTargetProps;
            return (<div className="react-data-grid-wrapper" {...props} />);
          }
        });

      const dropProps: TableDropTargetProps = {};
      if (this.props.dropProps) {
        const {onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes, canDropOn} = this.props.dropProps;
        dropProps.onDropTargetDrop = (args: DropTargetArguments): DropTargetArguments => {
            args.dropLocation = this.props.dataProvider;
            return onDropTargetDrop ? onDropTargetDrop(args) : args;
        };
        dropProps.onDropTargetOver = (args: DropTargetArguments) => {
          args.dropLocation = this.props.dataProvider;
          onDropTargetOver && onDropTargetOver(args);
        };
        dropProps.canDropTargetDrop = (args: DropTargetArguments) => {
          args.dropLocation = this.props.dataProvider;
          return canDropTargetDrop ? canDropTargetDrop(args) : true;
        };
        dropProps.objectTypes = objectTypes;
        dropProps.canDropOn = canDropOn;
      }
      const dragProps: DragSourceProps = {};
      if (this.props.dragProps) {
        const {onDragSourceBegin, onDragSourceEnd, objectType} = this.props.dragProps;
        dragProps.onDragSourceBegin = (args: DragSourceArguments) => {
          args.parentObject = this.props.dataProvider;
          if (args.dataObject !== undefined && args.row !== undefined && this.state.rows) {
            const { row } = args;
            if (row < this.state.rowsCount && this.state.rows[row]) {
              const rowItem = this.state.rows[row];
              if (rowItem !== undefined && rowItem.item !== undefined) {
                args.dataObject = rowItem.item.extendedData;
                args.dataObject.id = rowItem.item.key;
                args.dataObject.parentId = this.props.dataProvider;
              }
            }
          }
          if (onDragSourceBegin) return onDragSourceBegin(args);
          return args;
        };
        dragProps.onDragSourceEnd = (args: DragSourceArguments) => {
          args.parentObject = this.props.dataProvider;
          if (onDragSourceEnd) onDragSourceEnd(args);
        };
        dragProps.objectType = (data?: any) => {
          if (objectType) {
            if (typeof objectType === "function") {
              if (data) {
                const { row } = data;
                if (row >= 0 && row < this.state.rows.length) {
                  const rowItem = this.state.rows[row];
                  if (rowItem !== undefined && rowItem.item !== undefined) {
                    const d = rowItem.item.extendedData || {};
                    d.id = rowItem.item.key;
                    d.parentId = this.props.dataProvider;
                    return objectType(d);
                  }
                }
              }
            } else {
              return objectType;
            }
          }
          return "";
        };
      }
      return (
        <DragDropWrapper
          dropStyle={{
            height: "100%",
          }}
          dropProps={dropProps}
        >
          <ReactDataGrid
            columns={this.state.columns}
            rowGetter={this._rowGetter}
            rowsCount={this.state.rowsCount}
            enableCellSelect={true}
            minHeight={500}
            headerRowHeight={25}
            rowHeight={25}
            rowRenderer={
              <DragDropRow
                dropProps={dropProps}
                dragProps={dragProps}
              />
            }
            rowSelection={{
              showCheckbox: false,
              enableShiftSelect: true,
              onRowsSelected: this._onRowsSelected,
              onRowsDeselected: this._onRowsDeselected,
              selectBy: {
                keys: { rowKey: "__key", values: this.state.selectedRowKeys },
              },
            }}
            onRowClick={(index, row) => this._onRowClick(index, row as ReactDataGridRow)}
            onGridSort={this._handleGridSort}
          />
        </DragDropWrapper>
      );
    } else
      return (
          <ReactDataGrid
            columns={this.state.columns}
            rowGetter={this._rowGetter}
            rowsCount={this.state.rowsCount}
            enableCellSelect={true}
            minHeight={500}
            headerRowHeight={25}
            rowHeight={25}
            rowSelection={{
              showCheckbox: false,
              enableShiftSelect: true,
              onRowsSelected: this._onRowsSelected,
              onRowsDeselected: this._onRowsDeselected,
              selectBy: {
                keys: { rowKey: "__key", values: this.state.selectedRowKeys },
              },
            }}
            onRowClick={(index, row) => this._onRowClick(index, row as ReactDataGridRow)}
            onGridSort={this._handleGridSort}
          />
      );
  }
}

export interface IconCellProps {
  /** Icon name */
  value: string;
}

/**
 * Formatter for Bentley icons.
 */
export class IconCell extends React.Component<IconCellProps> {
  public render() {
    return <div className={`icon ${this.props.value}`} />;
  }
}
