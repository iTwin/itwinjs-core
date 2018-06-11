/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, InstanceKey } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionHandler, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/ecpresentation-frontend";
import { Table as BaseTable, RowItem } from "@bentley/ui-components";
import DataProvider from "./DataProvider";

/**
 * Properties that define how selection in the [[Table]] works
 */
export interface SelectionProps {
  /**
   * A callback to check if row should be selected.
   * **Note:** The default handler is not called if this callback
   * is set.
   */
  isRowSelected?: (row: RowItem) => boolean;

  /**
   * A callback called when rows are selected. Return true
   * to keep default handling or false to abort.
   */
  onRowsSelected?: (rows: RowItem[], replace: boolean) => boolean;

  /**
   * A callback called when rows are deselected. Return true
   * to keep default handling or false to abort.
   */
  onRowsDeselected?: (rows: RowItem[]) => boolean;

  /**
   * Boundary level of selection used by the table. The table requests
   * data for selection changes whose level is less than `level` and changes
   * selection at this `level`. Defaults to `1`.
   */
  level?: number;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * Props for the [[Table]] control.
 */
export interface Props {
  /** iModel to pull data from */
  imodel: IModelConnection;

  /** Presentation ruleset to use for creating the content for the control */
  rulesetId: string;

  /** The size of page used by the table. Defaults to `20`. */
  pageSize?: number;

  /** Optional ID for the control. The ID is also used as a selection handler name. */
  id?: string;

  /** Optional custom data provider implementation. */
  dataProvider?: DataProvider;

  /** Optional selection-related props */
  selection?: SelectionProps;
}

/**
 * Presentation rules -driven table control which also participates in
 * unified selection.
 */
export default class Table extends React.Component<Props> {

  private _base: React.RefObject<BaseTable>;
  private _dataProvider: DataProvider;
  private _selectionHandler: SelectionHandler;
  private _boundarySelectionLevel: number;

  public constructor(props: Props, context?: any) {
    super(props, context);
    this._base = React.createRef<BaseTable>();
    this._dataProvider = Table.getDataProviderFromProps(props);
    this._selectionHandler = Table.getSelectionHandlerFromProps(props);
    this._selectionHandler.onSelect = this.onSelectionChanged;
    this._boundarySelectionLevel = Table.getSelectionLevelFromProps(props);
  }

  private static getSelectionHandlerFromProps(props: Props): SelectionHandler {
    const key = props.id ? props.id : `Table_${new Date().getTime()}`;
    const handler = props.selection && props.selection.selectionHandler
      ? props.selection.selectionHandler : new SelectionHandler(ECPresentation.selection, key, props.imodel, props.rulesetId);
    return handler;
  }

  private static getPageSizeFromProps(props: Props): number {
    return (props.pageSize) ? props.pageSize : 20;
  }

  private static getDataProviderFromProps(props: Props): DataProvider {
    return props.dataProvider
      ? props.dataProvider
      : new DataProvider(props.imodel, props.rulesetId, Table.getPageSizeFromProps(props));
  }

  private static getSelectionLevelFromProps(props: Props): number {
    return (props.selection && undefined !== props.selection.level)
      ? props.selection.level : 1;
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  public componentWillReceiveProps(props: Props) {
    this._selectionHandler.imodel = props.imodel;
    this._selectionHandler.rulesetId = props.rulesetId;

    this._dataProvider.connection = props.imodel;
    this._dataProvider.rulesetId = props.rulesetId;

    this._boundarySelectionLevel = Table.getSelectionLevelFromProps(props);
  }

  /** Get selection handler used by the tree */
  public get selectionHandler(): SelectionHandler { return this._selectionHandler; }

  /** Get data provider of this tree */
  public get dataProvider(): DataProvider { return this._dataProvider; }

  private loadDataForSelection(evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) {
    for (let level = evt.level; level >= 0; level--) {
      const selection = selectionProvider.getSelection(this.props.imodel, level);
      if (!selection.isEmpty) {
        this._dataProvider.keys = selection;
        return;
      }
    }
    this._dataProvider.keys = new KeySet();
  }

  private highlightSelectedRows(_selection: Readonly<KeySet>) {
    if (!this._base.current)
      return;

    this._base.current.updateSelectedRows();
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider): void => {
    if (evt.level < this._boundarySelectionLevel || evt.level === 0) {
      // we get here when table should react to selection change by reloading the data
      // based on the new selection
      this.loadDataForSelection(evt, selectionProvider);
    } else if (evt.level === this._boundarySelectionLevel) {
      // we get here when table should react to selection change by
      // highlighting selected instances
      const selection = selectionProvider.getSelection(this.props.imodel, evt.level);
      this.highlightSelectedRows(selection);
    }
  }

  private getRowKey(row: RowItem): InstanceKey {
    return row.key as InstanceKey;
  }

  // tslint:disable-next-line:naming-convention
  private isRowSelected = (row: RowItem): boolean => {
    // give consumers a chance to tell if row is selected
    if (this.props.selection && this.props.selection.isRowSelected)
      return this.props.selection.isRowSelected(row);

    const selection = this._selectionHandler.getSelection(this._boundarySelectionLevel);
    return selection.has(this.getRowKey(row));
  }

  // tslint:disable-next-line:naming-convention
  private onRowsSelected = (rows: RowItem[], replace: boolean): boolean => {
    // give consumers a chance to handle selection changes and either
    // continue default handling (by returning `true`) or abort (by
    // returning `false`)
    if (this.props.selection && this.props.selection.onRowsSelected && !this.props.selection.onRowsSelected(rows, replace))
      return true;

    if (replace)
      this._selectionHandler.replaceSelection(rows.map((row) => this.getRowKey(row)), this._boundarySelectionLevel);
    else
      this._selectionHandler.addToSelection(rows.map((row) => this.getRowKey(row)), this._boundarySelectionLevel);
    return true;
  }

  // tslint:disable-next-line:naming-convention
  private onRowsDeselected = (rows: RowItem[]): boolean => {
    // give consumers a chance to handle selection changes and either
    // continue default handling (by returning `true`) or abort (by
    // returning `false`)
    if (this.props.selection && this.props.selection.onRowsDeselected && !this.props.selection.onRowsDeselected(rows))
      return true;

    this._selectionHandler.removeFromSelection(rows.map((row) => this.getRowKey(row)), this._boundarySelectionLevel);
    return true;
  }

  public render() {
    return (
      <BaseTable ref={this._base}
        dataProvider={this._dataProvider} pageAmount={Table.getPageSizeFromProps(this.props)}
        isRowSelected={this.isRowSelected} onRowsSelected={this.onRowsSelected} onRowsDeselected={this.onRowsDeselected}
      />
    );
  }
}
