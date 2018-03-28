import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionChangeEventArgs, ISelectionProvider, SelectionHandler } from "@bentley/ecpresentation-frontend";
import { PropertyPaneDataProvider, PropertyRecord } from "@bentley/ecpresentation-controls";
import { isPrimitiveValue, isStructValue, isArrayValue } from "@bentley/ecpresentation-controls";
import "./PropertiesWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
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
          <PropertyPane imodelToken={this.props.imodel.iModelToken} rulesetId={this.props.rulesetId} />
        </div>
      </div>
    );
  }
}

interface PropertyPaneProps {
  imodelToken: IModelToken;
  rulesetId: string;
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
  private _dataProvider: PropertyPaneDataProvider;
  private _selectionHandler: SelectionHandler;
  private _hasSelection: boolean;
  constructor(props: PropertyPaneProps, context?: any) {
    super(props, context);
    this.state = initialState;
    this._hasSelection = false;
    this._dataProvider = new PropertyPaneDataProvider(props.imodelToken, props.rulesetId);
    this._selectionHandler = new SelectionHandler(ECPresentation.selection, "Properties", props.imodelToken, props.rulesetId, this.onSelectionChanged);
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (_evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider): void => {
    this._hasSelection = false;
    for (let i = _evt.level; i >= 0; i--) {
      const selection = selectionProvider.getSelection(this.props.imodelToken, i);
      this._hasSelection = !selection.isEmpty;
      if (this._hasSelection) {
        this.fetchProperties(this.props.imodelToken, selection);
        return;
      }
    }
    this.fetchProperties(this.props.imodelToken, new KeySet());
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  public componentWillReceiveProps(newProps: PropertyPaneProps) {
    if (newProps.rulesetId !== this.props.rulesetId || newProps.imodelToken !== this.props.imodelToken) {
      this._selectionHandler.rulesetId = newProps.rulesetId;
      this._selectionHandler.imodelToken = newProps.imodelToken;
      this._dataProvider = new PropertyPaneDataProvider(newProps.imodelToken, newProps.rulesetId);
    }
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

  private async fetchProperties(_imodelToken: IModelToken, selection: Readonly<KeySet>) {
    this.setState(initialState);

    if (selection.isEmpty || !this._dataProvider)
      return;

    try {
      this._dataProvider.keys = selection;
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
    if (!this._hasSelection)
      return (<div className="NoData">Nothing selected</div>);
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
