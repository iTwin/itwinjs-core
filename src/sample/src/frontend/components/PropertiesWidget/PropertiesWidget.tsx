import * as React from "react";
// import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { InstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import PropertyPaneDataProvider from "@bentley/ecpresentation-frontend/lib/frontend/Controls/PropertyPaneDataProvider";
import { PropertyRecord } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/ContentBuilder";
import { TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TreeDataProvider";

import "./PropertiesWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId?: string;
  selectedNodes: TreeNodeItem[];
}
export default class PropertiesWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="PropertiesWidget">
        <h3>Properties</h3>
        <div className="ContentContainer">
          <PropertyPane imodelToken={this.props.imodel.iModelToken} rulesetId={this.props.rulesetId} selectedNodes={this.props.selectedNodes} />
        </div>
      </div>
    );
  }
}

interface PropertyPaneProps {
  imodelToken: IModelToken;
  rulesetId?: string;
  selectedNodes: TreeNodeItem[];
}
interface PropertyDisplayInfo {
  label: string;
  value: string | null;
}
interface PropertyPaneState {
  records?: PropertyDisplayInfo[];
}
class PropertyPane extends React.Component<PropertyPaneProps, PropertyPaneState> {
  private _presentationManager: ECPresentationManager;
  private _dataProvider: PropertyPaneDataProvider | undefined;

  constructor(props: PropertyPaneProps, context?: any) {
    super(props, context);
    this.state = {};
    this._presentationManager = new ECPresentationManager();
    if (props.rulesetId)
      this._dataProvider = new PropertyPaneDataProvider(this._presentationManager, props.imodelToken, props.rulesetId);
  }
  public componentWillMount() {
    this.fetchProperties(this.props.imodelToken, this.props.selectedNodes);
  }
  public componentWillReceiveProps(newProps: PropertyPaneProps) {
    if (newProps.rulesetId !== this.props.rulesetId)
      this._dataProvider = (newProps.rulesetId) ? new PropertyPaneDataProvider(this._presentationManager, newProps.imodelToken, newProps.rulesetId) : undefined;
    if (newProps.imodelToken !== this.props.imodelToken || !this.areSelectedNodesEqual(newProps.selectedNodes))
      this.fetchProperties(newProps.imodelToken, newProps.selectedNodes);
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
  private createRecordDisplayValue(value: any): string {
    if (!value)
      return "";
    if (typeof(value) === "string")
      return value;
    if (typeof(value) === "object" || Array.isArray(value))
      return JSON.stringify(value);
    return value.toString();
  }
  private async fetchProperties(_imodelToken: IModelToken, selectedNodes: TreeNodeItem[]) {
    if (0 === selectedNodes.length || !this._dataProvider) {
      this.setState({});
      return;
    }

    const keys: InstanceKey[] = selectedNodes.map((item: TreeNodeItem) => {
      return item.extendedData.node.key;
    });

    try {
      this._dataProvider.keys = keys;
      const records: PropertyDisplayInfo[] = [];
      const categoryCount = await this._dataProvider.getCategoryCount();
      for (let i = 0; i < categoryCount; ++i) {
        const propertiesCount = await this._dataProvider.getPropertyCount(i);
        const propertyPromises: Array<Promise<PropertyRecord>> = [];
        for (let j = 0; j < propertiesCount; ++j) {
          propertyPromises.push(this._dataProvider.getProperty(i, j));
        }
        const properties = await Promise.all(propertyPromises);
        for (const property of properties) {
          records.push({
            label: property.property.displayLabel,
            value: this.createRecordDisplayValue(property.displayValue),
          });
        }
        this.setState({ records });
      }
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.log("Error fetching element properties: " + error);
      this.setState({ records: undefined });
    }
  }
  public render() {
    if (!this.props.selectedNodes || 0 === this.props.selectedNodes.length)
      return (<div className="NoProperties">Nothing selected</div>);
    if (!this.state.records || 0 === this.state.records.length)
      return (<div className="NoProperties">No Properties</div>);
    return (
      <table>
        <tbody>
          {this.state.records.map((record: PropertyDisplayInfo, index: number) => (
            <tr key={index}>
              <td className="PropertyLabel">{record.label}</td>
              <td className="PropertyValue">{record.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
