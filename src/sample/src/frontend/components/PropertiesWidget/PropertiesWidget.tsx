import * as React from "react";
// import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { InstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import PropertyPaneDataProvider from "@bentley/ecpresentation-frontend/lib/frontend/Controls/PropertyPaneDataProvider";
import { TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TreeDataProvider";
import { isPrimitiveValue, isStructValue, isArrayValue, PropertyRecord } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/ContentBuilder";
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
  value?: string;
}
interface GroupDisplayInfo {
  label: string;
  records: PropertyDisplayInfo[];
}
interface PropertyPaneState {
  groups?: GroupDisplayInfo[];
  error?: string;
}
const initialState: PropertyPaneState = {
  groups: undefined,
  error: undefined,
};
class PropertyPane extends React.Component<PropertyPaneProps, PropertyPaneState> {
  private _presentationManager: ECPresentationManager;
  private _dataProvider: PropertyPaneDataProvider | undefined;

  constructor(props: PropertyPaneProps, context?: any) {
    super(props, context);
    this.state = initialState;
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
  private createRecordDisplayValues(record: PropertyRecord): PropertyDisplayInfo[] {
    const values = new Array<PropertyDisplayInfo>();
    const recordValue = record.value;
    if (!recordValue) {
      values.push({ label: record.property.displayLabel, value: "" });
    } else if (isPrimitiveValue(recordValue)) {
      let displayValue = "";
      if (!recordValue.displayValue)
        displayValue = "";
      else if (typeof (recordValue.displayValue) === "string")
        displayValue = recordValue.displayValue;
      else if (typeof (recordValue.displayValue) === "object" || Array.isArray(recordValue.displayValue))
        displayValue = JSON.stringify(recordValue.displayValue);
      else
        displayValue = recordValue.displayValue!.toString();
      values.push({ label: record.property.displayLabel, value: displayValue });
    } else if (isStructValue(recordValue)) {
      for (const key in recordValue.members) {
        if (recordValue.members.hasOwnProperty(key)) {
          const member = recordValue.members[key];
          const memberValues = this.createRecordDisplayValues(member);
          values.push(...memberValues);
        }
      }
    } else if (isArrayValue(recordValue)) {
      for (const member of recordValue.members) {
        const memberValues = this.createRecordDisplayValues(member);
        values.push(...memberValues);
      }
    }
    return values;
  }
  private async fetchProperties(_imodelToken: IModelToken, selectedNodes: TreeNodeItem[]) {
    if (0 === selectedNodes.length || !this._dataProvider) {
      this.setState(initialState);
      return;
    }

    const keys: InstanceKey[] = selectedNodes.map((item: TreeNodeItem) => {
      return item.extendedData.node.key;
    });

    try {
      this._dataProvider.keys = keys;
      const groups: GroupDisplayInfo[] = [];
      const categoryCount = await this._dataProvider.getCategoryCount();
      for (let i = 0; i < categoryCount; ++i) {
        const category = await this._dataProvider.getCategory(i);
        const records: PropertyDisplayInfo[] = [];
        const propertiesCount = await this._dataProvider.getPropertyCount(i);
        for (let j = 0; j < propertiesCount; ++j) {
          const prop = await this._dataProvider.getProperty(i, j);
          const values = this.createRecordDisplayValues(prop);
          records.push(...values);
        }
        const groupInfo = {
          label: category.label,
          records,
        } as GroupDisplayInfo;
        groups.push(groupInfo);
      }
      this.setState({ ...initialState, groups });
    } catch (error) {
      this.setState({ ...initialState, error: error.toString() });
    }
  }
  private renderGroupHeader(group: GroupDisplayInfo) {
    return (
      <th className="GroupLabel" rowSpan={group.records.length}>
        <div className="Rotated">{group.label}</div>
      </th>
    );
  }
  private renderGroup(group: GroupDisplayInfo) {
    return group.records.map((record: PropertyDisplayInfo, index: number) => (
      <tr key={index}>
        {(0 === index) ? this.renderGroupHeader(group) : ""}
        <td className="PropertyLabel">{record.label}</td>
        <td className="PropertyValue">{record.value}</td>
      </tr>
    ));
  }
  public render() {
    if (this.state.error)
      return (<div className="Error">{this.state.error}</div>);
    if (!this.props.selectedNodes || 0 === this.props.selectedNodes.length)
      return (<div className="NoProperties">Nothing selected</div>);
    if (!this.state.groups || 0 === this.state.groups.length)
      return (<div className="NoProperties">No Properties</div>);
    return (
      <table>
        <tbody>
          {this.state.groups.map((group: GroupDisplayInfo) => this.renderGroup(group))}
        </tbody>
      </table>
    );
  }
}
