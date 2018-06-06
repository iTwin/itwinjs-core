import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { InstanceKey, KeySet } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionChangeEventArgs, ISelectionProvider, SelectionHandler } from "@bentley/ecpresentation-frontend";
import { TableDataProvider } from "@bentley/ecpresentation-controls";
import { PropertyRecord, RowItem } from "@bentley/ui-components";
import "./GridWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export default class GridWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="GridWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
        <div className="ContentContainer">
          <Grid imodel={this.props.imodel} rulesetId={this.props.rulesetId} />
        </div>
      </div>
    );
  }
}

interface GridProps {
  imodel: IModelConnection;
  rulesetId: string;
}
interface ColumnDefinition {
  name: string;
  label: string;
}
interface RowDefinition {
  values: { [key: string]: string };
  selected: boolean;
  instanceKey: InstanceKey;
}
interface GridState {
  columns?: ColumnDefinition[];
  rows?: RowDefinition[];
  error?: string;
}
const initialState: GridState = {
  columns: [],
  rows: [],
  error: undefined,
};
class Grid extends React.Component<GridProps, GridState> {
  private _dataProvider: TableDataProvider;
  private _selectionHandler: SelectionHandler;
  private _hasSelection: boolean;

  constructor(props: GridProps, context?: any) {
    super(props, context);
    this.state = initialState;
    this._hasSelection = false;
    this._dataProvider = new TableDataProvider(props.imodel, props.rulesetId);
    this._selectionHandler = new SelectionHandler(ECPresentation.selection, "Grid", props.imodel.iModelToken, props.rulesetId, this.onSelectionChanged);
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider): void => {
    if (evt.level !== 0)
      return;
    const selectedItems = selectionProvider.getSelection(this.props.imodel.iModelToken, 0);
    this._hasSelection = !selectedItems.isEmpty;
    this.fetchData(selectedItems);
  }

  public componentWillReceiveProps(newProps: GridProps) {
    if (newProps.rulesetId !== this.props.rulesetId) {
      this._selectionHandler.rulesetId = newProps.rulesetId;
      this._dataProvider.rulesetId = newProps.rulesetId;
    }
    if (newProps.imodel !== this.props.imodel) {
      this._selectionHandler.imodelToken = newProps.imodel.iModelToken;
      this._dataProvider.connection = newProps.imodel;
    }
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  private async createCellDisplayValue(record?: PropertyRecord | string): Promise<string> {
    if (!record)
      return "";
    if (typeof record === "string")
      return record;
    return await record.getDisplayValue();
  }

  private async fetchData(selection: Readonly<KeySet>) {
    this.setState(initialState);

    if (selection.isEmpty || !this._dataProvider)
      return;

    try {
      this._dataProvider.keys = selection;
      const columnDescriptions = await this._dataProvider.getColumns();
      const columns = columnDescriptions.map((col): ColumnDefinition => ({
        name: col.key,
        label: col.label || "",
      }));
      this.setState({ ...initialState, columns });

      const rowsCount = await this._dataProvider.getRowsCount();
      const rowItems = await Promise.all((() => {
        const promises = new Array<Promise<RowItem>>();
        for (let i = 0; i < rowsCount; ++i)
          promises.push(this._dataProvider.getRow(i));
        return promises;
      })());
      const rows = await Promise.all(rowItems.map(async (item): Promise<RowDefinition> => {
        const values: { [key: string]: string } = {};
        await Promise.all(item.cells.map(async (cell) => {
          values[cell.key] = await this.createCellDisplayValue(cell.record);
        }));
        return { instanceKey: item.key, selected: false, values };
      }));
      this.setState({ ...initialState, columns, rows });

    } catch (error) {
      this.setState({ ...initialState, error: error.toString() });
    }
  }
  private renderHeaderRow() {
    return (
      <tr>
        {this.state.columns!.map((col) => (
          <th key={col.name}>{col.label}</th>
        ))}
      </tr>);
  }
  private renderCell(key: string, values: { [key: string]: string }) {
    try {
      return (<td key={key}>{values[key]}</td>);
    } catch (e) {
      return (<td key={key} className="Error">{e.toString()}</td>);
    }
  }
  private renderRow(row: RowDefinition, index: number) {
    return (
      <tr key={index} data-selected={row.selected} onClick={() => this._handleClick(index, row.instanceKey)}>
        {this.state.columns!.map((col) => this.renderCell(col.name, row.values))}
      </tr>);
  }
  private renderNoRecords(columnCount: number) {
    return (<tr><td className="NoData" colSpan={columnCount}>No records</td></tr>);
  }

  private _handleClick = (index: number, key: InstanceKey): void => {
    if (this.state.rows) {
      const row = this.state.rows[index];

      if (row.selected)
        this._selectionHandler.removeFromSelection([key], 1);
      else
        this._selectionHandler.addToSelection([key], 1);

      row.selected = !row.selected;
      this.forceUpdate();
    }
  }

  public render() {
    if (this.state.error)
      return (<div className="Error">{IModelApp.i18n.translate("Sample:controls.notifications.error")}: {this.state.error}</div>);
    if (!this._hasSelection)
      return (<div className="NoData">{IModelApp.i18n.translate("Sample:controls.notifications.nothing-selected")}</div>);
    if (!this.state.columns || 0 === this.state.columns.length)
      return (<div className="NoData">{IModelApp.i18n.translate("Sample:controls.notifications.no-data")}</div>);
    return (
      <table>
        <thead>
          {this.renderHeaderRow()}
        </thead>
        <tbody>
          {this.state.rows ? this.state.rows.map((row, index) => this.renderRow(row, index)) : this.renderNoRecords(this.state.columns.length)}
        </tbody>
      </table>
    );
  }
}
