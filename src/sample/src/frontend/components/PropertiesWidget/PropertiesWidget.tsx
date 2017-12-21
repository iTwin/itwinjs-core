import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { ECInstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import PropertyPaneDataProvider from "@bentley/ecpresentation-frontend/lib/frontend/Controls/PropertyPaneDataProvider";
import { PropertyRecord } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/ContentBuilder";

import "./PropertiesWidget.css";

export interface Props {
  imodelToken: IModelToken;
}
export interface State {
  instanceKey?: ECInstanceKey;
}
export default class PropertiesWidget extends React.Component<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  // tslint:disable-next-line:naming-convention
  private onECInstanceKeyEntered = (key: ECInstanceKey | undefined) => {
    this.setState({ ...this.state, instanceKey: key});
  }
  public render() {
    let pane = null;
    if (this.state.instanceKey)
      pane = (<PropertyPane imodelToken={this.props.imodelToken} instanceKey={this.state.instanceKey} />);

    return (
      <div className="PropertiesWidget">
        <h3>Properties</h3>
        <p className="Description">Enter ECInstance data to get properties</p>
        <InputFields onInstanceKeyEntered={this.onECInstanceKeyEntered} />
        <div className="ContentContainer">
          {pane}
        </div>
      </div>
    );
  }
}

interface InputFieldsProps {
  onInstanceKeyEntered: (key: ECInstanceKey | undefined) => void;
}
class InputFields extends React.Component<InputFieldsProps> {
  private _classId: string | undefined;
  private _instanceId: string | undefined;
  // tslint:disable-next-line:naming-convention
  private onClassIdValueChanged = (e: any) => {
    this._classId = e.target.value;
    if (this._classId && this._instanceId)
      this.props.onInstanceKeyEntered({ classId: this._classId, instanceId: this._instanceId });
    else
      this.props.onInstanceKeyEntered(undefined);
  }
  // tslint:disable-next-line:naming-convention
  private onInstanceIdValueChanged = (e: any) => {
    this._instanceId = e.target.value;
    if (this._classId && this._instanceId)
      this.props.onInstanceKeyEntered({ classId: this._classId, instanceId: this._instanceId });
    else
      this.props.onInstanceKeyEntered(undefined);
  }
  public render() {
    return (
      <div className="InputFields">
        <p>ClassId: </p><input onChange={this.onClassIdValueChanged} /><br />
        <p>InstanceId: </p><input onChange={this.onInstanceIdValueChanged} />
      </div>
    );
  }
}

interface PropertyPaneProps {
  imodelToken: IModelToken;
  instanceKey: ECInstanceKey;
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
    this._dataProvider = new PropertyPaneDataProvider(this._presentationManager, props.imodelToken, "");
  }
  public componentWillMount() {
    this.fetchProperties(this.props.imodelToken, this.props.instanceKey);
  }
  public componentWillReceiveProps(newProps: PropertyPaneProps) {
    if (newProps.imodelToken !== this.props.imodelToken || newProps.instanceKey !== this.props.instanceKey)
      this.fetchProperties(newProps.imodelToken, newProps.instanceKey);
  }
  private async fetchProperties(_imodelToken: IModelToken, instanceKey: ECInstanceKey) {
    try {
      const records: PropertyDisplayInfo[] = [];
      this._dataProvider.keys = [instanceKey];
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
            value: property.displayValue,
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
    if (!this.state.records || 0 === this.state.records.length)
      return (<div className="NoProperties">No Properties</div>);
    return (
      <table>
        {this.state.records.map((record: PropertyDisplayInfo) => (
            <tr>
              <td className="PropertyLabel">{record.label}</td>
              <td className="PropertyValue">{record.value}</td>
            </tr>
        ))}
      </table>
    );
  }
}
