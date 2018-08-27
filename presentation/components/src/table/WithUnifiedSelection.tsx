/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { KeySet, InstanceKey, Subtract, instanceKeyFromJSON } from "@bentley/presentation-common";
import { Presentation, SelectionHandler, SelectionChangeEventArgs } from "@bentley/presentation-frontend";
import { Table as BaseTable, TableProps, RowItem } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import IUnifiedSelectionComponent from "../common/IUnifiedSelectionComponent";
import PresentationTableDataProvider from "./DataProvider";

/**
 * Props that are injected to the HOC component.
 */
export interface Props {
  /** The data provider used by the property grid. */
  dataProvider: PresentationTableDataProvider;

  /**
   * Boundary level of selection used by the table. The table requests
   * data for selection changes whose level is less than `level` and changes
   * selection at this `level`. Defaults to `1`.
   */
  selectionLevel?: number;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * table component.
 *
 * **Note:** it is required for the table to use [[PresentationTableDataProvider]]
 */
// tslint:disable-next-line: variable-name naming-convention
export default function withUnifiedSelection<P extends TableProps>(TableComponent: React.ComponentType<P>): React.ComponentType<Subtract<P, Props> & Props> {

  type CombinedProps = Subtract<P, Props> & Props;

  return class WithUnifiedSelection extends React.Component<CombinedProps> implements IUnifiedSelectionComponent {

    private _base: React.RefObject<BaseTable>;
    private _boundarySelectionLevel: number;
    private _selectionHandler?: SelectionHandler;

    constructor(props: CombinedProps) {
      super(props);
      this._base = React.createRef<BaseTable>();
      this._boundarySelectionLevel = getSelectionLevelFromProps(props);
    }

    /** Returns the display name of this component */
    public static get displayName() { return `WithUnifiedSelection(${getDisplayName(TableComponent)})`; }

    /** Get selection handler used by this table */
    public get selectionHandler(): SelectionHandler | undefined { return this._selectionHandler; }

    public get imodel() { return this.props.dataProvider.connection; }

    public get rulesetId() { return this.props.dataProvider.rulesetId; }

    // tslint:disable-next-line:naming-convention
    private get baseProps(): Subtract<TableProps, Props> { return this.props; }

    public componentDidMount() {
      const name = `Table_${counter++}`;
      const imodel = this.props.dataProvider.connection;
      const rulesetId = this.props.dataProvider.rulesetId;
      this._selectionHandler = this.props.selectionHandler
        ? this.props.selectionHandler : new SelectionHandler(Presentation.selection, name, imodel, rulesetId);
      this._selectionHandler!.onSelect = this.onSelectionChanged;
      this.displaySelection();
    }

    public componentWillUnmount() {
      if (this._selectionHandler)
        this._selectionHandler.dispose();
    }

    public componentDidUpdate() {
      this._boundarySelectionLevel = getSelectionLevelFromProps(this.props);
      if (this._selectionHandler) {
        this._selectionHandler.imodel = this.props.dataProvider.connection;
        this._selectionHandler.rulesetId = this.props.dataProvider.rulesetId;
      }
    }

    private loadDataForSelection(selectionLevel: number) {
      for (let level = selectionLevel; level >= 0; level--) {
        const selection = this._selectionHandler!.getSelection(level);
        if (!selection.isEmpty) {
          this.props.dataProvider.keys = selection;
          return;
        }
      }
      this.props.dataProvider.keys = new KeySet();
    }

    private highlightSelectedRows(_selection: Readonly<KeySet>) {
      if (this._base.current)
        this._base.current.updateSelectedRows();
    }

    private displaySelection(selectionLevel?: number) {
      if (undefined === selectionLevel) {
        let availableLevels = this._selectionHandler!.getSelectionLevels();
        if (this.props.dataProvider.keys.isEmpty) {
          // if the data provider has no set keys, we have to find the right selection
          // level and set it's selection to data provider. we take the first highest
          // available selection level that's smaller than boundary or equal to 0
          availableLevels = availableLevels.reverse();
          for (const level of availableLevels) {
            if (level < this._boundarySelectionLevel || level === 0) {
              selectionLevel = level;
              break;
            }
          }
        } else {
          selectionLevel = (availableLevels.length > 0) ? availableLevels[availableLevels.length - 1] : undefined;
        }
      }
      if (undefined === selectionLevel)
        return;

      if (selectionLevel < this._boundarySelectionLevel || selectionLevel === 0) {
        // we get here when table should react to selection change by reloading the data
        // based on the new selection
        this.loadDataForSelection(selectionLevel);
      } else if (selectionLevel === this._boundarySelectionLevel) {
        // we get here when table should react to selection change by
        // highlighting selected instances
        const selection = this._selectionHandler!.getSelection(selectionLevel);
        this.highlightSelectedRows(selection);
      }
    }

    // tslint:disable-next-line:naming-convention
    private onSelectionChanged = (evt: SelectionChangeEventArgs): void => {
      this.displaySelection(evt.level);
    }

    private getRowKey(row: RowItem): InstanceKey {
      return instanceKeyFromJSON(JSON.parse(row.key));
    }

    private async getRowKeys(rows: AsyncIterableIterator<RowItem>): Promise<InstanceKey[]> {
      const keys = new Array<InstanceKey>();
      for await (const row of rows)
        keys.push(this.getRowKey(row));
      return keys;
    }

    // tslint:disable-next-line:naming-convention
    private isRowSelected = (row: RowItem): boolean => {
      // give consumers a chance to tell if row is selected
      if (this.baseProps.isRowSelected)
        return this.baseProps.isRowSelected(row);

      if (!this._selectionHandler)
        return false;

      const selection = this._selectionHandler.getSelection(this._boundarySelectionLevel);
      return selection.has(this.getRowKey(row));
    }

    // tslint:disable-next-line:naming-convention
    private onRowsSelected = async (rows: AsyncIterableIterator<RowItem>, replace: boolean): Promise<boolean> => {
      // give consumers a chance to handle selection changes and either
      // continue default handling (by returning `true`) or abort (by
      // returning `false`)
      if (this.baseProps.onRowsSelected && !(await this.baseProps.onRowsSelected(rows, replace)))
        return true;

      if (this._selectionHandler) {
        const keys = await this.getRowKeys(rows);
        if (replace)
          this._selectionHandler.replaceSelection(keys, this._boundarySelectionLevel);
        else
          this._selectionHandler.addToSelection(keys, this._boundarySelectionLevel);
      }
      return true;
    }

    // tslint:disable-next-line:naming-convention
    private onRowsDeselected = async (rows: AsyncIterableIterator<RowItem>): Promise<boolean> => {
      // give consumers a chance to handle selection changes and either
      // continue default handling (by returning `true`) or abort (by
      // returning `false`)
      if (this.baseProps.onRowsDeselected && !(await this.baseProps.onRowsDeselected(rows)))
        return true;

      if (this._selectionHandler) {
        const keys = await this.getRowKeys(rows);
        this._selectionHandler.removeFromSelection(keys, this._boundarySelectionLevel);
      }
      return true;
    }

    public render() {
      const {
        selectionHandler, selectionLevel, // do not bleed our props
        isRowSelected, onRowsSelected, onRowsDeselected, // take out the props we're overriding
        ...props /* tslint:disable-line: trailing-comma */ // pass-through props
      } = this.props as any;
      return (
        <TableComponent ref={this._base}
          isRowSelected={this.isRowSelected} onRowsSelected={this.onRowsSelected} onRowsDeselected={this.onRowsDeselected}
          {...props}
        />
      );
    }
  };
}

let counter = 1;

function getSelectionLevelFromProps(props: Props): number {
  return (undefined !== props.selectionLevel) ? props.selectionLevel : 1;
}
