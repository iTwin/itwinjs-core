import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { InstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import TableViewDataProvider from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TableViewDataProvider";
import { TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TreeDataProvider";

import "./GridWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId?: string;
  selectedNodes: TreeNodeItem[];
}
export default class GridWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="GridWidget">
        <h3>Grid</h3>
        <div className="ContentContainer">
          <Grid imodelToken={this.props.imodel.iModelToken} rulesetId={this.props.rulesetId} selectedNodes={this.props.selectedNodes} />
        </div>
      </div>
    );
  }
}

interface GridProps {
  imodelToken: IModelToken;
  rulesetId?: string;
  selectedNodes: TreeNodeItem[];
}
interface ColumnDefinition {
  name: string;
  label: string;
}
interface RowDefinition {
  values: {[key: string]: string};
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
  private _presentationManager: ECPresentationManager;
  private _dataProvider: TableViewDataProvider | undefined;

  constructor(props: GridProps, context?: any) {
    super(props, context);
    this.state = {};
    this._presentationManager = new ECPresentationManager();
    if (props.rulesetId)
      this._dataProvider = new TableViewDataProvider(this._presentationManager, props.imodelToken, props.rulesetId);
  }
  public componentWillMount() {
    this.fetchData(this.props.imodelToken, this.props.selectedNodes);
  }
  public componentWillReceiveProps(newProps: GridProps) {
    if (newProps.rulesetId !== this.props.rulesetId)
      this._dataProvider = (newProps.rulesetId) ? new TableViewDataProvider(this._presentationManager, newProps.imodelToken, newProps.rulesetId) : undefined;
    if (newProps.imodelToken !== this.props.imodelToken || !this.areSelectedNodesEqual(newProps.selectedNodes))
      this.fetchData(newProps.imodelToken, newProps.selectedNodes);
  }
  private areSelectedNodesEqual(newSelection: TreeNodeItem[]) {
    if (newSelection.length !== this.props.selectedNodes.length)
      return false;
    for (const newItem of newSelection) {
      for (const oldItem of this.props.selectedNodes) {
        if (newItem !== oldItem)
          return false;
      }
    }
    return true;
  }
  private createCellDisplayValue(value: any): string {
    if (!value)
      return "";
    if (typeof(value) === "string")
      return value;
    if (typeof(value) === "object" || Array.isArray(value))
      return JSON.stringify(value);
    return value.toString();
  }
  private async fetchData(_imodelToken: IModelToken, selectedNodes: TreeNodeItem[]) {
    if (0 === selectedNodes.length || !this._dataProvider) {
      this.setState(initialState);
      return;
    }

    const keys: InstanceKey[] = selectedNodes.map((item: TreeNodeItem) => {
      return item.extendedData.node.key;
    });

    try {
      this._dataProvider.keys = keys;
      const columns = new Array<ColumnDefinition>();
      const columnDescriptions = await this._dataProvider.getColumns();
      for (const columnDescription of columnDescriptions)
        columns.push({ name: columnDescription.key, label: columnDescription.label });
      this.setState({ ...initialState, columns });

      const rowsCount = await this._dataProvider.getRowsCount();
      const rows = new Array<RowDefinition>();
      for (let i = 0; i < rowsCount; ++i) {
        const row = await this._dataProvider.getRow(i);
        const values: { [key: string]: string } = {};
        for (const cell of row.cells)
          values[cell.key] = this.createCellDisplayValue(cell.displayValue);
        rows.push({ values });
      }
      this.setState({ ...initialState, columns, rows });

    } catch (error) {
      this.setState({ ...initialState, error: error.toString()});
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
  private renderRow(row: RowDefinition, index: number) {
    return (
      <tr key={index}>
        {this.state.columns!.map((col) => (
          <td key={col.name}>{row.values[col.name]}</td>
        ))}
      </tr>);
  }
  private renderNoRecords(columnCount: number) {
    return (<tr><td className="NoData" colSpan={columnCount}>No records</td></tr>);
  }
  public render() {
    if (this.state.error)
      return (<div className="Error">{this.state.error}</div>);
    if (0 === this.props.selectedNodes.length)
      return (<div className="NoData">Nothing selected</div>);
    if (!this.state.columns || 0 === this.state.columns.length)
      return (<div className="NoData">No data</div>);
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
