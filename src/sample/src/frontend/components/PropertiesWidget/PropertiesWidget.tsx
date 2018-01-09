import * as React from "react";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { InstanceKey } from "@bentley/ecpresentation-frontend/lib/common/EC";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import PropertyPaneDataProvider from "@bentley/ecpresentation-frontend/lib/frontend/Controls/PropertyPaneDataProvider";
import { PropertyRecord } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/ContentBuilder";

import "./PropertiesWidget.css";

export interface Props {
  imodel: IModelConnection;
}
export interface State {
  instanceKey?: InstanceKey;
}
export default class PropertiesWidget extends React.Component<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  // tslint:disable-next-line:naming-convention
  private onECInstanceKeyEntered = (key: InstanceKey | undefined) => {
    this.setState({ ...this.state, instanceKey: key });
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
  onInstanceKeyEntered: (key: InstanceKey | undefined) => void;
}
class InputFields extends React.Component<InputFieldsProps> {
  private _classIdInput: HTMLInputElement | null = null;
  private _classNameInput: HTMLInputElement | null = null;
  private _instanceIdInput: HTMLInputElement | null = null;
  private _classId: Id64 = new Id64();
  private _instanceId: Id64 = new Id64();
  private createDecimalString(id: Id64): string {
    // note: this won't always work when the numbers are higher
    return parseInt(id.toString().slice(2), 16).toString();
  }
  private verifyInstanceKey() {
    if (!this._classId.isValid() || !this._instanceId.isValid()) {
      this.props.onInstanceKeyEntered(undefined);
      return;
    }
    this.props.onInstanceKeyEntered({ classId: this.createDecimalString(this._classId), instanceId: this.createDecimalString(this._instanceId) });
  }
  // tslint:disable-next-line:naming-convention
  private onClassNameValueChanged = async (e: any) => {
    let classId = new Id64();
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
        if (Array.isArray(result) && result.length > 0)
          classId = new Id64(result[0].id);
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.log(e.message);
        className = "";
      }
    }
    this._instanceId = new Id64();
    this._instanceIdInput!.value = "";
    this._classId = classId;
    this._classIdInput!.value = classId.toString();
    this.verifyInstanceKey();
  }
  private async getClassName(classId: Id64): Promise<string> {
    const result = await this.props.imodel.executeQuery("\
      SELECT s.Name AS schemaName, c.Name AS className  \
      FROM [meta].[ECClassDef] c, [meta].[ECSchemaDef] s \
      WHERE c.Schema.Id = s.ECInstanceId \
        AND c.ECInstanceId = ?", [this.createDecimalString(classId)]);
    if (Array.isArray(result) && result.length > 0)
      return `${result[0].schemaName}:${result[0].className}`;
    return "";
  }
  // tslint:disable-next-line:naming-convention
  private onClassIdValueChanged = async (e: any) => {
    let className: string = "";
    let classId = new Id64(e.target.value);
    try {
      className = await this.getClassName(classId);
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log(e.message);
      classId = new Id64();
    }
    this._instanceId = new Id64();
    this._instanceIdInput!.value = "";
    this._classId = classId;
    this._classNameInput!.value = className;
    this.verifyInstanceKey();
  }
  // tslint:disable-next-line:naming-convention
  private onInstanceIdValueChanged = async (e: any) => {
    this._instanceId = new Id64(e.target.value);
    this.verifyInstanceKey();

    const result = await this.props.imodel.executeQuery("SELECT IFNULL(ECClassId, 0) AS classId, ECInstanceId FROM [meta].[ECClassDef]");
    for (const record of result) {
      // tslint:disable-next-line:no-console
      console.log((new Id64([parseInt(record.classId, 10), 0])).toString() + "\t" + record.id);
    }
  }
  // tslint:disable-next-line:naming-convention
  private randomize = async () => {
    const index = Math.floor(Math.random() * (RANDOM_INSTANCE_KEYS.length - 1));
    this._classId = new Id64(RANDOM_INSTANCE_KEYS[index].classId);
    this._classIdInput!.value = this._classId.toString();
    this._instanceId = new Id64(RANDOM_INSTANCE_KEYS[index].instanceId);
    this._instanceIdInput!.value = this._instanceId.toString();
    this._classNameInput!.value = await this.getClassName(this._classId);
    this.verifyInstanceKey();
  }
  public render() {
    return (
      <div className="InputFields">
        <p>ClassId: </p><input onChange={this.onClassIdValueChanged} ref={(input) => this._classIdInput = input} /><br />
        <p> or <code>schemaName:className</code></p><input onChange={this.onClassNameValueChanged} ref={(input) => this._classNameInput = input} /><br />
        <p>InstanceId: </p><input onChange={this.onInstanceIdValueChanged} ref={(input) => this._instanceIdInput = input} /><br />
        <button onClick={this.randomize}>Randomize</button>
      </div>
    );
  }
}

interface PropertyPaneProps {
  imodelToken: IModelToken;
  instanceKey: InstanceKey;
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
  private createRecordDisplayValueString(record: PropertyRecord): string {
    switch (record.property.typename) {
      case "point2d":
      case "point3d":
        return JSON.stringify(record.displayValue);
      default:
        return record.displayValue ? record.displayValue.toString() : "";
    }
  }
  private async fetchProperties(_imodelToken: IModelToken, instanceKey: InstanceKey) {
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

const RANDOM_INSTANCE_KEYS = [
  { classId: "0x3b", instanceId: "0x1000000002a" },
  { classId: "0x3b", instanceId: "0x1000000002b" },
  { classId: "0x3b", instanceId: "0x10000000032" },
  { classId: "0x3b", instanceId: "0x10000000033" },
  { classId: "0x3b", instanceId: "0x10000000039" },
  { classId: "0x3b", instanceId: "0x1000000003a" },
  { classId: "0x3b", instanceId: "0x10000000040" },
  { classId: "0x3b", instanceId: "0x10000000041" },
  { classId: "0x3b", instanceId: "0x10000000047" },
  { classId: "0x3b", instanceId: "0x10000000048" },
  { classId: "0x4c", instanceId: "0x1000000001a" },
  { classId: "0x4c", instanceId: "0x1000000001c" },
  { classId: "0x4c", instanceId: "0x10000000022" },
  { classId: "0x4c", instanceId: "0x10000000024" },
  { classId: "0x57", instanceId: "0x10000000028" },
  { classId: "0x63", instanceId: "0x1000000000d" },
  { classId: "0x63", instanceId: "0x1000000000e" },
  { classId: "0x63", instanceId: "0x1000000000f" },
  { classId: "0x63", instanceId: "0x1000000001e" },
  { classId: "0x63", instanceId: "0x1000000002d" },
  { classId: "0x67", instanceId: "0x10000000002" },
  { classId: "0x67", instanceId: "0x10000000004" },
  { classId: "0x67", instanceId: "0x10000000006" },
  { classId: "0x67", instanceId: "0x10000000008" },
  { classId: "0x67", instanceId: "0x10000000009" },
  { classId: "0x67", instanceId: "0x1000000000a" },
  { classId: "0x67", instanceId: "0x1000000000b" },
  { classId: "0x67", instanceId: "0x1000000001b" },
  { classId: "0x67", instanceId: "0x1000000001d" },
  { classId: "0x67", instanceId: "0x10000000023" },
  { classId: "0x67", instanceId: "0x10000000025" },
  { classId: "0x6d", instanceId: "0x10" },
  { classId: "0x70", instanceId: "0x1000000001f" },
  { classId: "0x70", instanceId: "0x1000000002f" },
  { classId: "0x70", instanceId: "0x10000000036" },
  { classId: "0x70", instanceId: "0x1000000003d" },
  { classId: "0x70", instanceId: "0x10000000044" },
  { classId: "0x70", instanceId: "0x1000000004b" },
  { classId: "0x71", instanceId: "0x10000000010" },
  { classId: "0x71", instanceId: "0x10000000011" },
  { classId: "0x71", instanceId: "0x10000000012" },
  { classId: "0x76", instanceId: "0x10000000018" },
  { classId: "0x76", instanceId: "0x10000000026" },
  { classId: "0x77", instanceId: "0x10000000019" },
  { classId: "0x78", instanceId: "0x10000000021" },
  { classId: "0x7d", instanceId: "0x10000000020" },
  { classId: "0x8d", instanceId: "0x10000000001" },
  { classId: "0x8d", instanceId: "0x10000000003" },
  { classId: "0x8d", instanceId: "0x10000000005" },
  { classId: "0x8d", instanceId: "0x10000000007" },
  { classId: "0xa1", instanceId: "0xe" },
  { classId: "0xa2", instanceId: "0x10000000014" },
  { classId: "0xa4", instanceId: "0x10000000015" },
  { classId: "0xa4", instanceId: "0x10000000017" },
  { classId: "0xa5", instanceId: "0x10000000013" },
  { classId: "0xa5", instanceId: "0x10000000016" },
  { classId: "0xb4", instanceId: "0x1000000000c" },
  { classId: "0xbe", instanceId: "0x10000000027" },
  { classId: "0xbe", instanceId: "0x10000000030" },
  { classId: "0xbe", instanceId: "0x10000000037" },
  { classId: "0xbe", instanceId: "0x1000000003e" },
  { classId: "0xbe", instanceId: "0x10000000045" },
  { classId: "0xc7", instanceId: "0x1000000002e" },
  { classId: "0xc7", instanceId: "0x10000000035" },
  { classId: "0xc7", instanceId: "0x1000000003c" },
  { classId: "0xc7", instanceId: "0x10000000043" },
  { classId: "0xc7", instanceId: "0x1000000004a" },
  { classId: "0xce", instanceId: "0x1" },
  { classId: "0xd3", instanceId: "0x10000000029" },
  { classId: "0xd3", instanceId: "0x10000000031" },
  { classId: "0xd3", instanceId: "0x10000000038" },
  { classId: "0xd3", instanceId: "0x1000000003f" },
  { classId: "0xd3", instanceId: "0x10000000046" },
  { classId: "0xda", instanceId: "0x1000000002c" },
  { classId: "0xda", instanceId: "0x10000000034" },
  { classId: "0xda", instanceId: "0x1000000003b" },
  { classId: "0xda", instanceId: "0x10000000042" },
  { classId: "0xda", instanceId: "0x10000000049" },
  { classId: "0xe7", instanceId: "0x1000000004c" },
  { classId: "0xe7", instanceId: "0x50000000001" },
  { classId: "0xe7", instanceId: "0x50000000002" },
  { classId: "0x6f", instanceId: "0x10" },
  { classId: "0x75", instanceId: "0x10000000018" },
  { classId: "0x75", instanceId: "0x10000000026" },
  { classId: "0x7a", instanceId: "0x10000000019" },
  { classId: "0xa0", instanceId: "0xe" },
  { classId: "0xb0", instanceId: "0x1000000000c" },
  { classId: "0xb9", instanceId: "0x1" },
  { classId: "0xc5", instanceId: "0x10000000027" },
  { classId: "0xc5", instanceId: "0x10000000030" },
  { classId: "0xc5", instanceId: "0x10000000037" },
  { classId: "0xc5", instanceId: "0x1000000003e" },
  { classId: "0xc5", instanceId: "0x10000000045" },
  { classId: "0xf", instanceId: "0x3b" },
  { classId: "0xf", instanceId: "0x55" },
  { classId: "0xf", instanceId: "0x56" },
  { classId: "0xf", instanceId: "0x57" },
  { classId: "0xf", instanceId: "0x58" },
  { classId: "0xf", instanceId: "0x59" },
  { classId: "0xf", instanceId: "0x5a" },
  { classId: "0xf", instanceId: "0x5b" },
  { classId: "0xf", instanceId: "0x5c" },
  { classId: "0xf", instanceId: "0x5d" },
  { classId: "0xf", instanceId: "0xde" },
  { classId: "0xf", instanceId: "0xe0" },
  { classId: "0xf", instanceId: "0x4d" },
  { classId: "0xf", instanceId: "0x66" },
  { classId: "0xf", instanceId: "0x63" },
  { classId: "0xf", instanceId: "0x68" },
  { classId: "0xf", instanceId: "0xa" },
  { classId: "0xf", instanceId: "0xe" },
  { classId: "0xf", instanceId: "0x12" },
  { classId: "0xf", instanceId: "0x26" },
  { classId: "0xf", instanceId: "0x45" },
  { classId: "0xf", instanceId: "0x1" },
  { classId: "0xf", instanceId: "0x13" },
  { classId: "0xf", instanceId: "0x48" },
  { classId: "0xf", instanceId: "0x47" },
  { classId: "0xf", instanceId: "0x6a" },
  { classId: "0xf", instanceId: "0x46" },
  { classId: "0xf", instanceId: "0x27" },
  { classId: "0xf", instanceId: "0x2" },
  { classId: "0xf", instanceId: "0x3" },
  { classId: "0xf", instanceId: "0x4e" },
  { classId: "0xf", instanceId: "0x6b" },
  { classId: "0xf", instanceId: "0x6d" },
  { classId: "0xf", instanceId: "0xe1" },
  { classId: "0xf", instanceId: "0xdf" },
  { classId: "0xf", instanceId: "0x6f" },
  { classId: "0xf", instanceId: "0x65" },
  { classId: "0xf", instanceId: "0x70" },
  { classId: "0xf", instanceId: "0x71" },
  { classId: "0xf", instanceId: "0x72" },
  { classId: "0xf", instanceId: "0x73" },
  { classId: "0xf", instanceId: "0x75" },
  { classId: "0xf", instanceId: "0x76" },
  { classId: "0xf", instanceId: "0x77" },
  { classId: "0xf", instanceId: "0x4c" },
  { classId: "0xf", instanceId: "0x78" },
  { classId: "0xf", instanceId: "0x79" },
  { classId: "0xf", instanceId: "0x7a" },
  { classId: "0xf", instanceId: "0x7c" },
  { classId: "0xf", instanceId: "0x7d" },
  { classId: "0xf", instanceId: "0x7e" },
  { classId: "0xf", instanceId: "0x28" },
  { classId: "0xf", instanceId: "0xf" },
  { classId: "0xf", instanceId: "0x16" },
  { classId: "0xf", instanceId: "0x18" },
  { classId: "0xf", instanceId: "0x14" },
  { classId: "0xf", instanceId: "0x21" },
  { classId: "0xf", instanceId: "0x11" },
  { classId: "0xf", instanceId: "0x3f" },
  { classId: "0xf", instanceId: "0x7f" },
  { classId: "0xf", instanceId: "0x80" },
  { classId: "0xf", instanceId: "0x81" },
  { classId: "0xf", instanceId: "0x82" },
  { classId: "0xf", instanceId: "0x83" },
  { classId: "0xf", instanceId: "0x86" },
  { classId: "0xf", instanceId: "0x4a" },
  { classId: "0xf", instanceId: "0x87" },
  { classId: "0xf", instanceId: "0x88" },
  { classId: "0xf", instanceId: "0x69" },
  { classId: "0xf", instanceId: "0x49" },
  { classId: "0xf", instanceId: "0x89" },
  { classId: "0xf", instanceId: "0xe2" },
  { classId: "0xf", instanceId: "0x34" },
  { classId: "0xf", instanceId: "0x8a" },
  { classId: "0xf", instanceId: "0x36" },
  { classId: "0xf", instanceId: "0x35" },
  { classId: "0xf", instanceId: "0x37" },
  { classId: "0xf", instanceId: "0x4" },
  { classId: "0xf", instanceId: "0x3e" },
  { classId: "0xf", instanceId: "0x3d" },
  { classId: "0xf", instanceId: "0x51" },
  { classId: "0xf", instanceId: "0x4b" },
  { classId: "0xf", instanceId: "0x8b" },
  { classId: "0xf", instanceId: "0x8e" },
  { classId: "0xf", instanceId: "0x8c" },
  { classId: "0xf", instanceId: "0x5f" },
  { classId: "0xf", instanceId: "0x5e" },
  { classId: "0xf", instanceId: "0x8f" },
  { classId: "0xf", instanceId: "0x90" },
  { classId: "0xf", instanceId: "0xe3" },
  { classId: "0xf", instanceId: "0x3c" },
  { classId: "0xf", instanceId: "0x91" },
  { classId: "0xf", instanceId: "0x93" },
  { classId: "0xf", instanceId: "0x7b" },
  { classId: "0xf", instanceId: "0x92" },
  { classId: "0xf", instanceId: "0xe4" },
  { classId: "0xf", instanceId: "0x94" },
  { classId: "0xf", instanceId: "0xe5" },
  { classId: "0xf", instanceId: "0x96" },
  { classId: "0xf", instanceId: "0x97" },
  { classId: "0xf", instanceId: "0x98" },
  { classId: "0xf", instanceId: "0xe6" },
  { classId: "0xf", instanceId: "0x29" },
  { classId: "0xf", instanceId: "0x2a" },
  { classId: "0xf", instanceId: "0x2b" },
  { classId: "0xf", instanceId: "0x74" },
  { classId: "0xf", instanceId: "0x4f" },
  { classId: "0xf", instanceId: "0x6c" },
  { classId: "0xf", instanceId: "0x6e" },
  { classId: "0xf", instanceId: "0x99" },
  { classId: "0xf", instanceId: "0x9a" },
  { classId: "0xf", instanceId: "0x9b" },
  { classId: "0xf", instanceId: "0x85" },
  { classId: "0xf", instanceId: "0x50" },
  { classId: "0xf", instanceId: "0x2c" },
  { classId: "0xf", instanceId: "0x44" },
  { classId: "0xf", instanceId: "0x5" },
  { classId: "0xf", instanceId: "0x1b" },
  { classId: "0xf", instanceId: "0x9c" },
  { classId: "0xf", instanceId: "0x9f" },
  { classId: "0xf", instanceId: "0x84" },
  { classId: "0xf", instanceId: "0xa0" },
  { classId: "0xf", instanceId: "0xa1" },
  { classId: "0xf", instanceId: "0x6" },
  { classId: "0xf", instanceId: "0x2d" },
  { classId: "0xf", instanceId: "0x41" },
  { classId: "0xf", instanceId: "0x40" },
  { classId: "0xf", instanceId: "0x43" },
  { classId: "0xf", instanceId: "0x42" },
  { classId: "0xf", instanceId: "0xa2" },
  { classId: "0xf", instanceId: "0xa3" },
  { classId: "0xf", instanceId: "0xb" },
  { classId: "0xf", instanceId: "0x38" },
  { classId: "0xf", instanceId: "0x39" },
  { classId: "0xf", instanceId: "0x3a" },
  { classId: "0xf", instanceId: "0x2e" },
  { classId: "0xf", instanceId: "0xa4" },
  { classId: "0xf", instanceId: "0x2f" },
  { classId: "0xf", instanceId: "0xa8" },
  { classId: "0xf", instanceId: "0xab" },
  { classId: "0xf", instanceId: "0xac" },
  { classId: "0xf", instanceId: "0xad" },
  { classId: "0xf", instanceId: "0xaf" },
  { classId: "0xf", instanceId: "0xb0" },
  { classId: "0xf", instanceId: "0xb2" },
  { classId: "0xf", instanceId: "0xe7" },
  { classId: "0xf", instanceId: "0xb4" },
  { classId: "0xf", instanceId: "0xb3" },
  { classId: "0xf", instanceId: "0xae" },
  { classId: "0xf", instanceId: "0xe8" },
  { classId: "0xf", instanceId: "0xb5" },
  { classId: "0xf", instanceId: "0xe9" },
  { classId: "0xf", instanceId: "0xc" },
  { classId: "0xf", instanceId: "0x1e" },
  { classId: "0xf", instanceId: "0x1d" },
  { classId: "0xf", instanceId: "0x15" },
  { classId: "0xf", instanceId: "0x1a" },
  { classId: "0xf", instanceId: "0x20" },
  { classId: "0xf", instanceId: "0x19" },
  { classId: "0xf", instanceId: "0x7" },
  { classId: "0xf", instanceId: "0x54" },
  { classId: "0xf", instanceId: "0x23" },
  { classId: "0xf", instanceId: "0x24" },
  { classId: "0xf", instanceId: "0xd" },
  { classId: "0xf", instanceId: "0x22" },
  { classId: "0xf", instanceId: "0xb7" },
  { classId: "0xf", instanceId: "0xb8" },
  { classId: "0xf", instanceId: "0xa9" },
  { classId: "0xf", instanceId: "0xb9" },
  { classId: "0xf", instanceId: "0xba" },
  { classId: "0xf", instanceId: "0xbb" },
  { classId: "0xf", instanceId: "0x25" },
  { classId: "0xf", instanceId: "0x8" },
  { classId: "0xf", instanceId: "0x30" },
  { classId: "0xf", instanceId: "0x10" },
  { classId: "0xf", instanceId: "0x17" },
  { classId: "0xf", instanceId: "0x1c" },
  { classId: "0xf", instanceId: "0x1f" },
  { classId: "0xf", instanceId: "0x31" },
  { classId: "0xf", instanceId: "0xea" },
  { classId: "0xf", instanceId: "0xbc" },
  { classId: "0xf", instanceId: "0xbd" },
  { classId: "0xf", instanceId: "0x9" },
  { classId: "0xf", instanceId: "0xbe" },
  { classId: "0xf", instanceId: "0xc2" },
  { classId: "0xf", instanceId: "0xc3" },
  { classId: "0xf", instanceId: "0xc4" },
  { classId: "0xf", instanceId: "0xbf" },
  { classId: "0xf", instanceId: "0xc5" },
  { classId: "0xf", instanceId: "0xc6" },
  { classId: "0xf", instanceId: "0xc0" },
  { classId: "0xf", instanceId: "0xc1" },
  { classId: "0xf", instanceId: "0xc7" },
  { classId: "0xf", instanceId: "0x8d" },
  { classId: "0xf", instanceId: "0x9e" },
  { classId: "0xf", instanceId: "0xc8" },
  { classId: "0xf", instanceId: "0xeb" },
  { classId: "0xf", instanceId: "0x9d" },
  { classId: "0xf", instanceId: "0xc9" },
  { classId: "0xf", instanceId: "0xcb" },
  { classId: "0xf", instanceId: "0xcc" },
  { classId: "0xf", instanceId: "0xcd" },
  { classId: "0xf", instanceId: "0xca" },
  { classId: "0xf", instanceId: "0xb1" },
  { classId: "0xf", instanceId: "0xa5" },
  { classId: "0xf", instanceId: "0xa7" },
  { classId: "0xf", instanceId: "0x67" },
  { classId: "0xf", instanceId: "0xce" },
  { classId: "0xf", instanceId: "0xcf" },
  { classId: "0xf", instanceId: "0xd0" },
  { classId: "0xf", instanceId: "0x32" },
  { classId: "0xf", instanceId: "0x33" },
  { classId: "0xf", instanceId: "0x95" },
  { classId: "0xf", instanceId: "0xb6" },
  { classId: "0xf", instanceId: "0xd1" },
  { classId: "0xf", instanceId: "0xd2" },
  { classId: "0xf", instanceId: "0xd3" },
  { classId: "0xf", instanceId: "0xd4" },
  { classId: "0xf", instanceId: "0xd6" },
  { classId: "0xf", instanceId: "0xd7" },
  { classId: "0xf", instanceId: "0xd5" },
  { classId: "0xf", instanceId: "0xd8" },
  { classId: "0xf", instanceId: "0xd9" },
  { classId: "0xf", instanceId: "0xec" },
  { classId: "0xf", instanceId: "0x52" },
  { classId: "0xf", instanceId: "0x53" },
  { classId: "0xf", instanceId: "0xaa" },
  { classId: "0xf", instanceId: "0xda" },
  { classId: "0xf", instanceId: "0xed" },
  { classId: "0xf", instanceId: "0xee" },
  { classId: "0xf", instanceId: "0x61" },
  { classId: "0xf", instanceId: "0x60" },
  { classId: "0xf", instanceId: "0xa6" },
  { classId: "0xf", instanceId: "0x62" },
  { classId: "0xf", instanceId: "0x64" },
  { classId: "0xf", instanceId: "0xdb" },
  { classId: "0xf", instanceId: "0xdc" },
  { classId: "0xf", instanceId: "0xdd" },
];
