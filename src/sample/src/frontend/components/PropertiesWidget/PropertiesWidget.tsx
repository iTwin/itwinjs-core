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
  selectedNode?: TreeNodeItem;
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
          <PropertyPane imodelToken={this.props.imodel.iModelToken} selectedNode={this.props.selectedNode} />
        </div>
      </div>
    );
  }
}

interface PropertyPaneProps {
  imodelToken: IModelToken;
  selectedNode?: TreeNodeItem;
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
  private _dataProvider: PropertyPaneDataProvider;

  constructor(props: PropertyPaneProps, context?: any) {
    super(props, context);
    this.state = {};
    this._presentationManager = new ECPresentationManager();
    this._dataProvider = new PropertyPaneDataProvider(this._presentationManager, props.imodelToken, "Custom");
  }
  public componentWillMount() {
    this.fetchProperties(this.props.imodelToken, this.props.selectedNode);
  }
  public componentWillReceiveProps(newProps: PropertyPaneProps) {
    if (newProps.imodelToken !== this.props.imodelToken || newProps.selectedNode !== this.props.selectedNode)
      this.fetchProperties(newProps.imodelToken, newProps.selectedNode);
  }
  private createRecordDisplayValueString(record: PropertyRecord): string {
    switch (record.property.typename) {
      case "point2d":
      case "point3d":
        return JSON.stringify(record.displayValue);
      default:
        return record.displayValue ? record.displayValue.toString() : "";
    }
  }
  private async fetchProperties(_imodelToken: IModelToken, selectedNode?: TreeNodeItem) {
    if (!selectedNode)
      return;

    const key = selectedNode.extendedData.node.key;
    if (!key.classId || !key.instanceId)
      return;

    try {
      const instanceKey: InstanceKey = { classId: key.classId, instanceId: key.instanceId };
      this._dataProvider.keys = [instanceKey];
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
            value: this.createRecordDisplayValueString(property),
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
    if (!this.props.selectedNode)
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
