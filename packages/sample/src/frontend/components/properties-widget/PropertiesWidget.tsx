import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionChangeEventArgs, ISelectionProvider, SelectionHandler } from "@bentley/ecpresentation-frontend";
import { PropertyDataProvider } from "@bentley/ecpresentation-controls";
import { PropertyRecord, PropertyCategory, PropertyValueFormat } from "@bentley/ui-components";
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
        <h3>{IModelApp.i18n.translate("Sample:controls.properties")}</h3>
        <div className="ContentContainer">
          <PropertyPane imodel={this.props.imodel} rulesetId={this.props.rulesetId} />
        </div>
      </div>
    );
  }
}

interface PropertyPaneProps {
  imodel: IModelConnection;
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
  private _dataProvider: PropertyDataProvider;
  private _selectionHandler: SelectionHandler;
  private _hasSelection: boolean;

  constructor(props: PropertyPaneProps, context?: any) {
    super(props, context);
    this.state = initialState;
    this._hasSelection = false;
    this._dataProvider = new PropertyDataProvider(props.imodel, props.rulesetId);
    this._selectionHandler = new SelectionHandler(ECPresentation.selection, "Properties", props.imodel.iModelToken, props.rulesetId, this.onSelectionChanged);
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (_evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider): void => {
    this._hasSelection = false;
    for (let i = _evt.level; i >= 0; i--) {
      const selection = selectionProvider.getSelection(this.props.imodel.iModelToken, i);
      this._hasSelection = !selection.isEmpty;
      if (this._hasSelection) {
        this.fetchProperties(selection);
        return;
      }
    }
    this.fetchProperties(new KeySet());
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  public componentWillReceiveProps(newProps: PropertyPaneProps) {
    if (newProps.rulesetId !== this.props.rulesetId) {
      this._selectionHandler.rulesetId = newProps.rulesetId;
      this._dataProvider.rulesetId = newProps.rulesetId;
    }
    if (newProps.imodel !== this.props.imodel) {
      this._selectionHandler.imodelToken = newProps.imodel.iModelToken;
      this._dataProvider.connection = newProps.imodel;
    }
  }

  private createRecordDisplayValues(record: PropertyRecord): PropertyDisplayInfo[] {
    const values = new Array<PropertyDisplayInfo>();
    const recordValue = record.value;
    if (!recordValue) {
      values.push({ label: record.property.displayLabel, value: "" });
    } else if (recordValue.valueFormat === PropertyValueFormat.Primitive) {
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
    } else if (recordValue.valueFormat === PropertyValueFormat.Struct) {
      for (const key in recordValue.members) {
        if (recordValue.members.hasOwnProperty(key)) {
          const member = recordValue.members[key];
          const memberValues = this.createRecordDisplayValues(member);
          values.push(...memberValues);
        }
      }
    } else if (recordValue.valueFormat === PropertyValueFormat.Array) {
      for (const member of recordValue.items) {
        const memberValues = this.createRecordDisplayValues(member);
        values.push(...memberValues);
      }
    }
    return values;
  }

  private async fetchProperties(selection: Readonly<KeySet>) {
    this.setState(initialState);

    if (selection.isEmpty || !this._dataProvider)
      return;

    try {
      this._dataProvider.keys = selection;
      const data = await this._dataProvider.getData();
      const groups: GroupDisplayInfo[] = data.categories.map((category: PropertyCategory) => {
        const displayInfos: PropertyDisplayInfo[] = [];
        data.records[category.name].forEach((record: PropertyRecord) => {
          const values = this.createRecordDisplayValues(record);
          displayInfos.push(...values);
        });
        return {
          label: category.label,
          records: displayInfos,
        };
      });
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
      return (<div className="Error">{IModelApp.i18n.translate("Sample:controls.notifications.error")}: {this.state.error}</div>);
    if (!this._hasSelection)
      return (<div className="NoData">{IModelApp.i18n.translate("Sample:controls.notifications.nothing-selected")}</div>);
    if (!this.state.groups || 0 === this.state.groups.length)
      return (<div className="NoProperties">{IModelApp.i18n.translate("Sample:controls.notifications.no-properties")}</div>);
    return (
      <table>
        <tbody>
          {this.state.groups.map((group: GroupDisplayInfo) => this.renderGroup(group))}
        </tbody>
      </table>
    );
  }
}
