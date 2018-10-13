/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as _ from "lodash";
import * as React from "react";
import ReactDataGrid from "react-data-grid";
import classnames from "classnames";
import { DisposableList, Guid } from "@bentley/bentleyjs-core";
import { SortDirection } from "@bentley/ui-core";
import { TableDataProvider, ColumnDescription, RowItem, CellItem } from "../TableDataProvider";
import { withDropTarget, WithDropTargetProps, DragSourceArguments, DropTargetArguments, DragSourceProps, DropTargetProps } from "../../dragdrop";
import { DragDropRow } from "./DragDropRowRenderer";
import { DragDropHeaderCell } from "./DragDropHeaderCell";
import { LocalUiSettings, UiSettings, UiSettingsStatus } from "@bentley/ui-core";
import { SelectionMode } from "../../common/selection/SelectionModes";
import {
  SelectionHandler, SingleSelectionHandler, MultiSelectionHandler,
  OnItemsSelectedCallback, OnItemsDeselectedCallback,
} from "../../common/selection/SelectionHandler";

import "./Grid.scss";
import { EditorContainer, PropertyUpdatedArgs } from "../../editors/EditorContainer";

/**
 * Specifies table selection target.
 */
export enum TableSelectionTarget {
  Row,
  Cell,
}

/** Props for the Table React component */
export interface TableProps {
  /** Data provider for the Table */
  dataProvider: TableDataProvider;
  /** Amount of rows per page */
  pageAmount?: number;

  /** Called when rows are loaded */
  onRowsLoaded?: (firstRowIndex: number, lastRowIndex: number) => void;

  /** Callback for determining if row is selected */
  isRowSelected?: (row: RowItem) => boolean;
  /** Callback for when rows are selected */
  onRowsSelected?: (rowIterator: AsyncIterableIterator<RowItem>, replace: boolean) => Promise<boolean>;
  /** Callback for when rows are deselected */
  onRowsDeselected?: (rowIterator: AsyncIterableIterator<RowItem>) => Promise<boolean>;

  /** Callback for determining if cell is selected */
  isCellSelected?: (rowIndex: number, cell: CellItem) => boolean;
  /** Callback for when cells are selected */
  onCellsSelected?: (cellIterator: AsyncIterableIterator<[RowItem, CellItem]>, replace: boolean) => Promise<boolean>;
  /** Callback for when cells are deselected */
  onCellsDeselected?: (cellIterator: AsyncIterableIterator<[RowItem, CellItem]>) => Promise<boolean>;

  /** Specifies the selection target. */
  tableSelectionTarget?: TableSelectionTarget;
  /** Specifies the selection mode. */
  selectionMode?: SelectionMode;

  dragProps?: DragSourceProps;
  dropProps?: TableDropTargetProps;
  /** Callback for when properties are being edited */
  onPropertyEditing?: (args: CellEditorState) => void;
  /** Callback for when properties are updated */
  onPropertyUpdated?: (args: PropertyUpdatedArgs) => Promise<boolean>;
  reorderableColumns?: boolean;
  /** Optional parameter for persistent UI settings. Used for row reordering and row collapsing persistency. */
  uiSettings?: UiSettings;
  /** Identifying string used for persistent state. */
  settingsIdentifier?: string;
}

/** Properties for the Table's DropTarget. */
export interface TableDropTargetProps extends DropTargetProps {
  /** Used for table components that allow dropping inside. Ie. [[BreadcrumbDetails]]. */
  canDropOn?: boolean;
}

/** Properties for a Table cell */
export interface CellProps {
  item: CellItem;
  displayValue: string;
  render: () => React.ReactNode;
}

/** Properties for a Table row */
export interface RowProps {
  index: number;
  item: RowItem;
  cells: { [key: string]: CellProps };
  render?: () => React.ReactNode;
}

interface RowsLoadResult {
  rows: RowProps[];
  selectedRowIndices: number[];
  selectedCellKeys: CellKey[];
}

/** Cell/Property Editor state */
export interface CellEditorState {
  active: boolean;
  rowIndex?: number;
  colIndex?: number;
  cellKey?: string;
}

/** State for the [[Table]] component */
export interface TableState {
  columns: ReactDataGridColumn[];
  rows: RowProps[];
  rowsCount: number;
  cellEditorState: CellEditorState;
}

/** ReactDataGrid.Column with additional properties */
export interface ReactDataGridColumn extends ReactDataGrid.Column {
  icon?: boolean;
}

const initialState: TableState = {
  columns: [],
  rows: [],
  rowsCount: 0,
  cellEditorState: { active: false },
};

interface CellKey {
  rowIndex: number;
  columnKey: string;
}

/** TableRowRenderer props. */
interface TableRowRendererProps {
  rowRendererCreator: () => any;
}

/** ReactDataGrid requires a class component for the RowRenderer because it sets a ref to it. */
class TableRowRenderer extends React.Component<TableRowRendererProps> {
  public render() {
    const creatorFn = this.props.rowRendererCreator();
    return creatorFn(this.props);
  }
}

/**
 * Table React component
 */
export class Table extends React.Component<TableProps, TableState> {

  private _pageAmount = 100;
  private _disposableListeners = new DisposableList();
  private _isMounted = false;
  private _rowLoadGuid = new Guid(true);
  private _rowSelectionHandler: SelectionHandler<number>;
  private _cellSelectionHandler: SelectionHandler<CellKey>;
  private _selectedRowIndices: Set<number> = new Set();
  private _selectedCellKeys: Map<string, Set<number>> = new Map(); // column keys -> rowIndices
  private _rowItemSelectionHandlers?: Array<SingleSelectionHandler<number>>;
  private _cellItemSelectionHandlers?: Array<Array<SingleSelectionHandler<CellKey>>>;
  private _pressedItemSelected: boolean = false;

  public readonly state: Readonly<TableState> = initialState;

  constructor(props: TableProps, context?: any) {
    super(props, context);

    if (props.pageAmount)
      this._pageAmount = props.pageAmount;

    this._disposableListeners.add(props.dataProvider.onColumnsChanged.addListener(this._onColumnsChanged));
    this._disposableListeners.add(props.dataProvider.onRowsChanged.addListener(this._onRowsChanged));
    this._rowSelectionHandler = new SelectionHandler(props.selectionMode ? props.selectionMode : SelectionMode.Single);
    this._cellSelectionHandler = new SelectionHandler(props.selectionMode ? props.selectionMode : SelectionMode.Single);
    this._rowSelectionHandler.onItemsSelectedCallback = this._onRowsSelected;
    this._rowSelectionHandler.onItemsDeselectedCallback = this._onRowsDeselected;
    this._cellSelectionHandler.onItemsSelectedCallback = this._onCellsSelected;
    this._cellSelectionHandler.onItemsDeselectedCallback = this._onCellsDeselected;
  }

  // tslint:disable-next-line:naming-convention
  private get rowItemSelectionHandlers(): Array<SingleSelectionHandler<number>> {
    if (!this._rowItemSelectionHandlers) {
      this._rowItemSelectionHandlers = [];
      for (let i = 0; i < this.state.rowsCount; i++)
        this._rowItemSelectionHandlers.push(this.createRowItemSelectionHandler(i));
    }
    return this._rowItemSelectionHandlers;
  }

  // tslint:disable-next-line:naming-convention
  private get cellItemSelectionHandlers(): Array<Array<SingleSelectionHandler<CellKey>>> {
    if (!this._cellItemSelectionHandlers) {
      this._cellItemSelectionHandlers = [];
      for (let rowIndex = 0; rowIndex < this.state.rowsCount; rowIndex++) {
        this._cellItemSelectionHandlers[rowIndex] = [];
        for (const column of this.state.columns) {
          this._cellItemSelectionHandlers[rowIndex].push(this.createCellItemSelectionHandler({ rowIndex, columnKey: column.key }));
        }
      }
    }
    return this._cellItemSelectionHandlers;
  }

  private async * createRowIterator(rowIndices: number[]): AsyncIterableIterator<RowItem> {
    for (const index of rowIndices)
      yield await this.props.dataProvider.getRow(index);
  }

  private async * createCellIterator(cellKeys: CellKey[]): AsyncIterableIterator<[RowItem, CellItem]> {
    for (const key of cellKeys) {
      const row = await this.props.dataProvider.getRow(key.rowIndex);
      yield [row, this._getCellItem(row, key.columnKey)];
    }
  }

  private _onRowsSelected: OnItemsSelectedCallback<number> = (rowIndices: number[], replace: boolean) => {
    if (this.props.onRowsSelected)
      this.props.onRowsSelected(this.createRowIterator(rowIndices), replace);
  }

  private _onRowsDeselected: OnItemsDeselectedCallback<number> = (rowIndices: number[]) => {
    if (this.props.onRowsDeselected)
      this.props.onRowsDeselected(this.createRowIterator(rowIndices));
  }

  private _onCellsSelected: OnItemsSelectedCallback<CellKey> = (cellKeys: CellKey[], replace: boolean) => {
    if (this.props.onCellsSelected)
      this.props.onCellsSelected(this.createCellIterator(cellKeys), replace);
  }

  private _onCellsDeselected: OnItemsDeselectedCallback<CellKey> = (cellKeys: CellKey[]) => {
    if (this.props.onCellsDeselected)
      this.props.onCellsDeselected(this.createCellIterator(cellKeys));
  }

  private get _tableSelectionTarget(): TableSelectionTarget {
    return this.props.tableSelectionTarget ? this.props.tableSelectionTarget : TableSelectionTarget.Row;
  }

  public componentWillReceiveProps(newProps: TableProps) {
    this._rowSelectionHandler.selectionMode = newProps.selectionMode ? newProps.selectionMode : SelectionMode.Single;
    this._cellSelectionHandler.selectionMode = newProps.selectionMode ? newProps.selectionMode : SelectionMode.Single;

    if (this.props.dataProvider !== newProps.dataProvider) {
      this._disposableListeners.dispose();
      this._disposableListeners.add(newProps.dataProvider.onColumnsChanged.addListener(this._onColumnsChanged));
      this._disposableListeners.add(newProps.dataProvider.onRowsChanged.addListener(this._onRowsChanged));
    }
  }

  public componentDidUpdate(previousProps: TableProps) {
    if (this.props.dataProvider !== previousProps.dataProvider)
      this.update();
    else if (this.props.isCellSelected !== previousProps.isCellSelected
      || this.props.isRowSelected !== previousProps.isRowSelected) {
      this.updateSelectedRows();
      this.updateSelectedCells();
    }
  }

  public componentDidMount() {
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

    let columns = columnDescriptions.map(this._columnDescriptionToReactDataGridColumn);
    if (this.props.settingsIdentifier) {
      const uiSettings: UiSettings = this.props.uiSettings || new LocalUiSettings();
      const result = uiSettings.getSetting(this.props.settingsIdentifier, "ColumnReorder");
      if (result.status === UiSettingsStatus.Sucess) {
        const setting = result.setting as string[];
        // map columns according to the keys in columns, in the order of the loaded array of keys
        columns = setting.map((key) => columns.filter((col) => col.key === key)[0]);
      } else if (result.status === UiSettingsStatus.NotFound) {
        const keys = columnDescriptions.map((col) => col.key);
        uiSettings.saveSetting(this.props.settingsIdentifier, "ColumnReorder", keys);
      }
    }
    this.setState(() => {
      return {
        columns,
      };
    });
  }

  private _onColumnsChanged = async () => {
    await this.updateColumns();

    this._cellItemSelectionHandlers = undefined;
  }

  private async updateRows() {
    const rowsCount = await this.props.dataProvider.getRowsCount();
    if (!this._isMounted)
      return;

    if (rowsCount !== this.state.rowsCount) {
      this._rowItemSelectionHandlers = undefined;
      this._cellItemSelectionHandlers = undefined;
    }

    this._rowGetterAsync.cache.clear();
    this.setState((prev: TableState) => ({
      ...prev,
      rowsCount,
    }));
    this._rowGetterAsync(0, true);
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
    const selectedRowIndices = new Set();
    if (this.props.isRowSelected) {
      for (let rowIndex = 0; rowIndex < this.state.rows.length; rowIndex++) {
        if (this.state.rows[rowIndex] && this.props.isRowSelected(this.state.rows[rowIndex].item))
          selectedRowIndices.add(rowIndex);
      }
    }
    this._selectedRowIndices = selectedRowIndices;
    this.forceUpdate();
  }

  public updateSelectedCells() {
    const selectedCellKeys = new Map<string, Set<number>>();
    if (this.props.isCellSelected) {
      for (const column of this.state.columns) {
        const set = new Set<number>();
        for (let rowIndex = 0; rowIndex < this.state.rows.length; rowIndex++) {
          if (!this.state.rows[rowIndex])
            continue;
          const cellItem = this._getCellItem(this.state.rows[rowIndex].item, column.key);
          if (this.props.isCellSelected(rowIndex, cellItem))
            set.add(rowIndex);
        }
        if (set.size !== 0)
          selectedCellKeys.set(column.key, set);
      }
    }
    this._selectedCellKeys = selectedCellKeys;
    this.forceUpdate();
  }

  private _columnDescriptionToReactDataGridColumn = (columnDescription: ColumnDescription): ReactDataGridColumn => {

    const editable = (columnDescription.editable !== undefined ? columnDescription.editable : false);

    const column: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
      icon: columnDescription.icon,
      resizable: columnDescription.resizable !== undefined ? columnDescription.resizable : false,
      sortable: columnDescription.sortable !== undefined ? columnDescription.sortable : false,
      draggable: this.props.reorderableColumns || false,
    };

    if (editable) {
      column.events = {
        onClick: this.cellEditOnClick.bind(this, column),
      };
    }

    return column;
  }

  private _getCellItem = (row: RowItem, columnKey: string): CellItem => {
    return row.cells.find((cell: CellItem) => cell.key === columnKey) || { key: columnKey };
  }

  private isCellSelected(key: CellKey) {
    const set = this._selectedCellKeys.get(key.columnKey);
    if (set)
      return set.has(key.rowIndex);
    return false;
  }

  private selectCells(cellKeys: CellKey[]) {
    for (const key of cellKeys) {
      let set = this._selectedCellKeys.get(key.columnKey);
      if (!set) {
        set = new Set();
        this._selectedCellKeys.set(key.columnKey, set);
      }
      set.add(key.rowIndex);
    }
  }

  private deselectCells(cellKeys: CellKey[]) {
    for (const key of cellKeys) {
      const set = this._selectedCellKeys.get(key.columnKey);
      if (set)
        set.delete(key.rowIndex);
    }
  }

  private createRowItemSelectionHandler(rowIndex: number): SingleSelectionHandler<number> {
    return {
      preselect: () => {
        this._pressedItemSelected = this._selectedRowIndices.has(rowIndex);
      },
      select: () => {
        if (!this._selectedRowIndices.has(rowIndex)) {
          this._selectedRowIndices.add(rowIndex);
          if (!this._pressedItemSelected)
            this.forceUpdate();
        }
      },
      deselect: () => {
        if (this._selectedRowIndices.has(rowIndex)) {
          this._selectedRowIndices.delete(rowIndex);
          this.forceUpdate();
        }
      },
      isSelected: () => this._selectedRowIndices.has(rowIndex),
      item: () => rowIndex,
    };
  }

  private _rowComponentSelectionHandler: MultiSelectionHandler<number> = {
    deselectAll: () => {
      this._selectedRowIndices = new Set();
      if (!this._pressedItemSelected) {
        this._deactivateCellEditor();
        this.forceUpdate();
      }
    },
    selectBetween: (rowIndex1: number, rowIndex2: number) => {
      const selections = [];
      const lowerNumber = rowIndex1 < rowIndex2 ? rowIndex1 : rowIndex2;
      const higherNumber = rowIndex1 > rowIndex2 ? rowIndex1 : rowIndex2;
      for (let i = lowerNumber; i <= higherNumber; i++) {
        if (!this._selectedRowIndices.has(i)) {
          selections.push(i);
          this._selectedRowIndices.add(i);
        }
      }

      this.forceUpdate();
      return selections;
    },
    updateSelection: (selections: number[], deselections: number[]): void => {
      for (const rowIndex of selections) {
        if (!this._selectedRowIndices.has(rowIndex))
          this._selectedRowIndices.add(rowIndex);
      }

      for (const rowIndex of deselections) {
        if (this._selectedRowIndices.has(rowIndex))
          this._selectedRowIndices.delete(rowIndex);
      }
      this.forceUpdate();
    },
    areEqual: (item1: number, item2: number) => item1 === item2,
  };

  private createCellItemSelectionHandler(cellKey: CellKey): SingleSelectionHandler<CellKey> {
    return {
      preselect: () => {
        this._pressedItemSelected = this.isCellSelected(cellKey);
      },
      select: () => {
        this.selectCells([cellKey]);
        this.forceUpdate();
      },
      deselect: () => {
        this.deselectCells([cellKey]);
        this.forceUpdate();
      },
      isSelected: () => this.isCellSelected(cellKey),
      item: () => cellKey,
    };
  }

  private _cellComponentSelectionHandler: MultiSelectionHandler<CellKey> = {
    deselectAll: () => {
      this._selectedCellKeys = new Map();
      this.forceUpdate();
    },
    selectBetween: (item1: CellKey, item2: CellKey) => {
      const selections: CellKey[] = [];
      const lowerIndex = item1.rowIndex < item2.rowIndex ? item1.rowIndex : item2.rowIndex;
      const higherIndex = item1.rowIndex > item2.rowIndex ? item1.rowIndex : item2.rowIndex;
      let secondItem: CellKey;
      let firstItemFound = false;
      let secondItemFound = false;

      for (let rowIndex = lowerIndex; rowIndex <= higherIndex; rowIndex++) {
        for (const column of this.state.columns) {
          if (!firstItemFound) {
            if (rowIndex === item1.rowIndex && column.key === item1.columnKey) {
              firstItemFound = true;
              secondItem = item2;
            } else if (rowIndex === item2.rowIndex && column.key === item2.columnKey) {
              firstItemFound = true;
              secondItem = item1;
            } else
              continue;
          }

          const cellKey = { rowIndex, columnKey: column.key };
          if (!this.isCellSelected(cellKey))
            selections.push(cellKey);

          if (rowIndex === secondItem!.rowIndex && column.key === secondItem!.columnKey) {
            secondItemFound = true;
            break;
          }
        }
        if (secondItemFound)
          break;
      }

      this.selectCells(selections);
      this.forceUpdate();
      return selections;
    },
    updateSelection: (selections: CellKey[], deselections: CellKey[]): void => {
      this.selectCells(selections);
      this.deselectCells(deselections);
      this.forceUpdate();
    },
    areEqual: (item1: CellKey, item2: CellKey) => item1.rowIndex === item2.rowIndex && item1.columnKey === item2.columnKey,
  };

  private _rowGetter = (i: number): RowProps => {
    if (this.state.rows[i])
      return this.state.rows[i];

    // get another page of rows
    // note: always start loading at the beginning of a page to avoid
    // requesting duplicate data (e.g. a page that starts at 0, at 1, at 2, ...)
    this._rowGetterAsync(i - (i % this._pageAmount), false);

    // Return placeholder object
    return { item: { key: "", cells: [] }, index: i, cells: {} };
  }

  private _rowGetterAsync = _.memoize(async (index: number, clearRows: boolean): Promise<void> => {
    if (index < 0)
      return;

    // load up to `this._pageAmount` more rows
    const maxIndex = Math.min(this.state.rowsCount, index + this._pageAmount);
    const loadResult = await this.loadRows(index, maxIndex);
    if (!this._isMounted)
      return;

    const selectedRowIndices = this._selectedRowIndices;
    for (const rowIndex of loadResult.selectedRowIndices) {
      if (!selectedRowIndices.has(rowIndex))
        selectedRowIndices.add(rowIndex);
    }
    this._selectedRowIndices = selectedRowIndices;

    this.selectCells(loadResult.selectedCellKeys);
    this.setState((prev) => {
      const rows = clearRows ? [] : [...prev.rows];
      loadResult.rows.forEach((r, i) => { rows[index + i] = r; });
      return { rows };
    }, () => {
      if (this.props.onRowsLoaded)
        this.props.onRowsLoaded(index, index + loadResult.rows.length - 1);
    });
  });

  private async createCellRenderer(cellItem: CellItem, column: ReactDataGridColumn, displayValue: string): Promise<() => React.ReactNode> {
    if (!cellItem.record)
      return () => undefined;
    if (column.icon)
      return () => <IconCell value={displayValue} />;
    return () => displayValue;
  }

  private async getCellDisplayValue(cellItem: CellItem): Promise<string> {
    if (!cellItem.record)
      return "";
    const displayValue = await cellItem.record.getDisplayValue();
    return displayValue;
  }

  private async createPropsForRowItem(item: RowItem, index: number): Promise<RowProps> {
    const cellProps: { [key: string]: CellProps } = {};
    for (const column of this.state.columns) {
      const cellItem = this._getCellItem(item, column.key);
      const displayValue = await this.getCellDisplayValue(cellItem);
      cellProps[column.key] = {
        item: cellItem,
        displayValue,
        render: await this.createCellRenderer(cellItem, column, displayValue),
      };
    }
    return {
      item,
      index,
      cells: cellProps,
      render: undefined,
    };
  }

  private async loadRows(beginIndex: number, endIndex: number): Promise<RowsLoadResult> {
    const result: RowsLoadResult = {
      rows: [],
      selectedRowIndices: [],
      selectedCellKeys: [],
    };
    this._rowLoadGuid = new Guid(true);
    const currentSelectedRowGuid = new Guid(this._rowLoadGuid);

    const promises = new Array<Promise<RowProps>>();
    for (let i = beginIndex; i < endIndex; ++i) {
      promises.push(
        this.props.dataProvider.getRow(i).then((rowData) =>
          this.createPropsForRowItem(rowData, i).then((rowProps) => (rowProps)),
        ));
    }

    try {
      result.rows = await Promise.all(promises);
    } catch { }

    // Check if another loadRows got called while this one was still going
    if (currentSelectedRowGuid.equals(this._rowLoadGuid)) {
      for (const rowProps of result.rows) {
        if (this.props.isRowSelected && this.props.isRowSelected(rowProps.item))
          result.selectedRowIndices.push(rowProps.index);

        if (this.props.isCellSelected) {
          for (const column of this.state.columns) {
            const cellItem = this._getCellItem(rowProps.item, column.key);
            if (this.props.isCellSelected(rowProps.index, cellItem))
              result.selectedCellKeys.push({ rowIndex: rowProps.index, columnKey: column.key });
          }
        }
      }
    }

    return result;
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

  private createRowCells(rowProps: RowProps): { [columnKey: string]: React.ReactNode } {
    const cells: { [columnKey: string]: React.ReactNode } = {};
    let columnIndex = -1;
    for (const column of this.state.columns) {
      columnIndex++;
      const cellProps = rowProps.cells[column.key];
      if (!cellProps) {
        continue;
      }
      const cell = cellProps.render();
      const editorCell = this.state.cellEditorState.active && this.state.cellEditorState.rowIndex === rowProps.index && this.state.cellEditorState.colIndex === columnIndex;
      if (this._tableSelectionTarget === TableSelectionTarget.Cell) {
        const cellKey = { rowIndex: rowProps.index, columnKey: column.key };
        const selectionHandler = this.createCellItemSelectionHandler(cellKey);
        const selectionFunction = this._cellSelectionHandler.createSelectionFunction(this._cellComponentSelectionHandler, selectionHandler);
        const onClick = (e: React.MouseEvent) => selectionFunction(e.shiftKey, e.ctrlKey);
        const onMouseMove = (e: React.MouseEvent) => { if (e.buttons === 1) this._cellSelectionHandler.updateDragAction(cellKey); };
        const onMouseDown = () => {
          this._cellSelectionHandler.createDragAction(this._cellComponentSelectionHandler, this.cellItemSelectionHandlers, cellKey);
        };
        const className = classnames("cell", this.isCellSelected(cellKey) ? "is-selected" : "is-hover-enabled");
        cells[column.key] = <div
          className={className}
          onClick={onClick}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}>
          {cell}
        </div>;
      } else {
        if (editorCell) {
          cells[column.key] = <EditorContainer propertyRecord={cellProps.item.record} title={cellProps.displayValue} onCommit={this._onCellCommit} onCommitCancel={this._deactivateCellEditor} />;
        } else
          cells[column.key] = <div className={"cell"} title={cellProps.displayValue}>{cell}</div>;
      }
    }
    return cells;
  }

  private _createRowRenderer = (dropProps?: TableDropTargetProps, dragProps?: DragSourceProps) => {
    return (props: { row: RowProps }) => {
      const { row: rowProps, ...reactDataGridRowProps } = props;
      const cells = this.createRowCells(rowProps);
      if (this._tableSelectionTarget === TableSelectionTarget.Row) {
        const selectionFunction = this._rowSelectionHandler.createSelectionFunction(this._rowComponentSelectionHandler, this.createRowItemSelectionHandler(props.row.index));
        const onClick = (e: React.MouseEvent) => {
          selectionFunction(e.shiftKey, e.ctrlKey);
        };
        const onMouseDown = (_e: React.MouseEvent) => {
          this._rowSelectionHandler.createDragAction(this._rowComponentSelectionHandler, [this.rowItemSelectionHandlers], props.row.index);
        };
        const onMouseMove = (e: React.MouseEvent) => {
          if (e.buttons === 1)
            this._rowSelectionHandler.updateDragAction(props.row.index);
        };
        const isSelected = this._selectedRowIndices.has(props.row.index);
        const row = dropProps || dragProps ? this._createDragAndDropRow(dropProps, dragProps, { ...reactDataGridRowProps, row: cells, isSelected }) :
          <ReactDataGrid.Row {...reactDataGridRowProps} row={cells} isSelected={isSelected} />;
        return <div
          className={classnames("row", !isSelected && "is-hover-enabled")}
          onClickCapture={onClick}
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}>
          {row}
        </div>;
      }
      return dropProps || dragProps ? this._createDragAndDropRow(dropProps, dragProps, { ...reactDataGridRowProps, row: cells }) :
        <ReactDataGrid.Row {...reactDataGridRowProps} row={cells} />;
    };
  }

  private _createDragAndDropRow = (dropProps?: TableDropTargetProps, dragProps?: DragSourceProps, props?: any) => {
    return <DragDropRow
      dropProps={dropProps}
      dragProps={dragProps}
      {...props}
    />;
  }

  private _onMouseUp = () => {
    if (this._tableSelectionTarget === TableSelectionTarget.Row)
      this._rowSelectionHandler.completeDragAction();
    else
      this._cellSelectionHandler.completeDragAction();
  }

  private _onMouseDown = () => {
    document.addEventListener("mouseup", this._onMouseUp, { capture: true, once: true });
  }
  private _onHeaderDrop = (source: string, target: string) => {
    const cols = [ ...this.state.columns ];
    const columnSourceIndex = this.state.columns.findIndex((i) => i.key === source);
    const columnTargetIndex = this.state.columns.findIndex((i) => i.key === target);

    cols.splice(columnTargetIndex, 0, cols.splice(columnSourceIndex, 1)[0]);
    if (this.props.settingsIdentifier) {
      const uiSettings: UiSettings = this.props.uiSettings || new LocalUiSettings();
      const keys = cols.map((col) => col.key);
      uiSettings.saveSetting(this.props.settingsIdentifier, "ColumnReorder", keys);
    }
    this.setState({ columns: cols });
  }
  private cellEditOnClick(column: ReactDataGridColumn, _ev: React.SyntheticEvent<any>, args: { rowIdx: number, idx: number, name: string }): void {
    let activate = false;

    const isSelected = this._selectedRowIndices.has(args.rowIdx);
    if (isSelected && this._pressedItemSelected)
      activate = true;

    if (activate)
      this.activateCellEditor(args.rowIdx, args.idx, column.key);
    else
      this._deactivateCellEditor();
  }

  private activateCellEditor(rowIndex: number, colIndex: number, cellKey: string): void {
    const cellEditorState = { active: true, rowIndex, colIndex, cellKey };
    if (cellEditorState !== this.state.cellEditorState) {
      this.setState(
        { cellEditorState },
        () => {
          if (this.props.onPropertyEditing)
            this.props.onPropertyEditing(cellEditorState);
        },
      );
    }
  }

  private _deactivateCellEditor = (): void => {
    if (this.state.cellEditorState.active)
      this.setState({ cellEditorState: { active: false } });
  }

  public shouldComponentUpdate(_props: TableProps): boolean {
    return true;
  }

  private getRowItem(rowIndex: number): RowItem | undefined {
    const row = this.state.rows[rowIndex];
    return row ? row.item : undefined;
  }

  private updateRowItem(rowIndex: number, rowItem: RowItem): void {
    const row = this.state.rows[rowIndex];
    if (row)
      row.item = rowItem;
  }

  private _onCellCommit = async (args: PropertyUpdatedArgs) => {
    if (this.props.onPropertyUpdated) {
      const allowed = await this.props.onPropertyUpdated(args);
      if (allowed && this.state.cellEditorState.rowIndex !== undefined && this.state.cellEditorState.rowIndex >= 0) {
        const rowItem = this.getRowItem(this.state.cellEditorState.rowIndex);
        if (rowItem) {
          const cellItem = rowItem.cells.find((cell) => cell.key === this.state.cellEditorState.cellKey);
          if (cellItem) {
            cellItem.record = args.propertyRecord;
            this.updateRowItem(this.state.cellEditorState.rowIndex, rowItem);
            this._deactivateCellEditor();
            await this.updateRows();
          }
        }
      } else {
        this._deactivateCellEditor();
      }
    }
  }

  public render() {
    const wrapperName = "react-data-grid-wrapper";
    const { dragProps: drag, dropProps: drop } = this.props;
    if ((drag && (drag.onDragSourceBegin || drag.onDragSourceEnd)) ||
      (drop && (drop.onDropTargetOver || drop.onDropTargetDrop))) {
      // tslint:disable-next-line:variable-name
      const DragDropWrapper =
        withDropTarget(class extends React.Component<React.HTMLAttributes<HTMLDivElement>> {
          public render(): React.ReactNode {
            const { isOver, canDrop, item, type, ...props } = this.props as WithDropTargetProps;
            return (<div className={wrapperName} {...props} />);
          }
        });

      const dropProps: TableDropTargetProps = {};
      if (this.props.dropProps) {
        const { onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes, canDropOn } = this.props.dropProps;
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
        const { onDragSourceBegin, onDragSourceEnd, objectType } = this.props.dragProps;
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

      const rowRenderer = <TableRowRenderer rowRendererCreator={() => this._createRowRenderer(dropProps, dragProps)} />;

      return (
        <DragDropWrapper
          dropStyle={{
            height: "100%",
          }}
          dropProps={dropProps}
          onMouseDown={this._onMouseDown}
        >
          <ReactDataGrid
            columns={this.state.columns}
            rowGetter={this._rowGetter}
            rowRenderer={rowRenderer}
            {...(this.props.reorderableColumns ? {
              draggableHeaderCell: DragDropHeaderCell,
              onHeaderDrop: this._onHeaderDrop,
            } as any : {})}
            rowsCount={this.state.rowsCount}
            enableCellSelect={true}
            minHeight={500}
            headerRowHeight={25}
            rowHeight={25}
            onGridSort={this._handleGridSort}
          />
        </DragDropWrapper>
      );
    } else {
      const rowRenderer = <TableRowRenderer rowRendererCreator={() => this._createRowRenderer()} />;

      return (
        <div className={wrapperName} onMouseDown={this._onMouseDown}>
          <ReactDataGrid
            columns={this.state.columns}
            rowGetter={this._rowGetter}
            rowRenderer={rowRenderer}
            {...(this.props.reorderableColumns ? {
              draggableHeaderCell: DragDropHeaderCell,
              onHeaderDrop: this._onHeaderDrop,
            } as any : {})}
            rowsCount={this.state.rowsCount}
            enableCellSelect={true}
            minHeight={500}
            headerRowHeight={25}
            rowHeight={25}
            onGridSort={this._handleGridSort}
          />
        </div>
      );
    }
  }
}

/** Properties for the [[IconCell]] component  */
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
