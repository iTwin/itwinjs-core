import * as React from "react";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { ECInstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import PropertyPaneDataProvider from "@bentley/ecpresentation-frontend/lib/frontend/Controls/PropertyPaneDataProvider";
import { PropertyRecord } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/ContentBuilder";

import "./PropertiesWidget.css";

export interface Props {
  imodel: IModelConnection;
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
      pane = (<PropertyPane imodelToken={this.props.imodel.iModelToken} instanceKey={this.state.instanceKey} />);

    return (
      <div className="PropertiesWidget">
        <h3>Properties</h3>
        <p className="Description">Enter ECInstance data to get properties</p>
        <InputFields imodel={this.props.imodel} onInstanceKeyEntered={this.onECInstanceKeyEntered} />
        <div className="ContentContainer">
          {pane}
        </div>
      </div>
    );
  }
}

interface InputFieldsProps {
  imodel: IModelConnection;
  onInstanceKeyEntered: (key: ECInstanceKey | undefined) => void;
}
interface InputFieldsState {
  classId: string;
  className: string;
  instanceId: string;
}
class InputFields extends React.Component<InputFieldsProps, InputFieldsState> {
  constructor(props: InputFieldsProps, context?: any) {
    super(props, context);
    this.state = { classId: "", className: "", instanceId: "" };
  }
  private verifyInstanceKey() {
    if (this.state.classId && this.state.instanceId)
      this.props.onInstanceKeyEntered({ classId: this.state.classId, instanceId: this.state.instanceId });
    else
      this.props.onInstanceKeyEntered(undefined);
  }
  // tslint:disable-next-line:naming-convention
  private onClassNameValueChanged = async (e: any) => {
    let classId: string = "";
    let className: string = e.target.value;
    const splits = className.split(":");
    if (2 === splits.length) {
      try {
        const result = await this.props.imodel.executeQuery("\
          SELECT c.ECInstanceId \
          FROM [meta].[ECClassDef] c, [meta].[ECSchemaDef] s \
          WHERE c.Schema.Id = s.ECInstanceId \
            AND (LOWER(s.Name) = LOWER(?) OR LOWER(s.Alias) = LOWER(?)) \
            AND LOWER(c.Name) = LOWER(?)", [splits[0], splits[0], splits[1]]);
        if (Array.isArray(result) && result.length > 0) {
          const id = new Id64(result[0].id);
          classId = id.getLow().toString();
        }
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.log(e.message);
        className = "";
      }
    }
    this.setState({ instanceId: "", classId, className });
    this.verifyInstanceKey();
  }
  // tslint:disable-next-line:naming-convention
  private onClassIdValueChanged = async (e: any) => {
    let className: string = "";
    let classId: string = e.target.value;
    try {
      const result = await this.props.imodel.executeQuery("\
        SELECT s.Name AS schemaName, c.Name AS className  \
        FROM [meta].[ECClassDef] c, [meta].[ECSchemaDef] s \
        WHERE c.Schema.Id = s.ECInstanceId \
          AND c.ECInstanceId = ?", [classId]);
      if (Array.isArray(result) && result.length > 0)
        className = `${result[0].schemaName}:${result[0].className}`;
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log(e.message);
      classId = "";
    }
    this.setState({ instanceId: "", classId, className });
    this.verifyInstanceKey();
  }
  // tslint:disable-next-line:naming-convention
  private onInstanceIdValueChanged = (e: any) => {
    this.setState({ ...this.state, instanceId: e.target.value });
    this.verifyInstanceKey();
  }
  public render() {
    return (
      <div className="InputFields">
        <p>ClassId: </p><input onChange={this.onClassIdValueChanged} value={this.state.classId} /><br />
        <p> or <code>schemaName:className</code></p><input onChange={this.onClassNameValueChanged} value={this.state.className} /><br />
        <p>InstanceId: </p><input onChange={this.onInstanceIdValueChanged} value={this.state.instanceId} />
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
