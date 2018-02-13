import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { InstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import TableViewDataProvider, { RowItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TableViewDataProvider";
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
}
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
      this.setState({});
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
      this.setState({ columns });

      const rowsCount = await this._dataProvider.getRowsCount();
      const rowPromises = new Array<Promise<RowItem>>();
      for (let i = 0; i < rowsCount; ++i)
        rowPromises.push(this._dataProvider.getRow(i));
      const rows = (await Promise.all(rowPromises)).map((rowItem: RowItem): RowDefinition => {
        const values: { [key: string]: string } = {};
        for (const cell of rowItem.cells)
          values[cell.key] = this.createCellDisplayValue(cell.displayValue);
        return { values };
      });
      this.setState({ columns, rows });

    } catch (error) {
      // tslint:disable-next-line:no-console
      console.log("Error fetching grid data: " + error);
      this.setState({});
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
  private renderNoRecords() {
    return (<tr><td className="NoData">No records</td></tr>);
  }
  public render() {
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
          {this.state.rows ? this.state.rows.map((row, index) => this.renderRow(row, index)) : this.renderNoRecords()}
        </tbody>
      </table>
    );
  }
}
