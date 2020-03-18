/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import classnames from "classnames";

// cSpell:Ignore configurableui

import {
  PropertyRecord, DialogItem,
  PropertyEditorParams, PropertyEditorParamTypes, SuppressLabelEditorParams, PrimitiveValue,
  DialogPropertySyncItem, DialogItemValue, PropertyValueFormat, UiDataProvider,
} from "@bentley/ui-abstract";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";
import { PropertyUpdatedArgs, EditorContainer } from "@bentley/ui-components";

import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { FrontstageManager } from "../../frontstage/FrontstageManager";
import { ToolUiManager, SyncToolSettingsPropertiesEventArgs } from "../toolsettings/ToolUiManager";
import { UiFramework } from "../../UiFramework";

import "./DefaultToolSettingsProvider.scss";
import { ToolSettingsContentContext } from "../../widgets/ToolSettingsContent";
import { FrameworkVersionSwitch } from "../../hooks/useFrameworkVersion";
import { WidgetPanelsDefaultToolSettings } from "../../widget-panels/DefaultToolSettings";

/** Responsive Layout Mode */
enum LayoutMode {
  Wide = 0,
  Narrow = 1,
}

/** @internal */
class TsRow {
  public priority = 0;
  public records: DialogItem[] = [];

  constructor(priority: number, record: DialogItem) {
    this.priority = priority;
    this.records.push(record);
  }

  public static editorWantsLabel(record: DialogItem): boolean {
    if (record.property.editor && record.property.editor.params) {
      const params = record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.SuppressEditorLabel) as SuppressLabelEditorParams;
      // istanbul ignore else
      if (params)
        return false;
    }
    return true;
  }

  public static hasAssociatedLockProperty(record: DialogItem): boolean {
    return !!record.lockProperty;
  }

  public get onlyContainButtonGroupEditors() {
    for (const record of this.records) {
      // istanbul ignore else
      if (TsRow.hasAssociatedLockProperty(record) || undefined === record.property.editor || "enum-buttongroup" !== record.property.editor.name || TsRow.editorWantsLabel(record))
        return false;
    }
    return true;
  }
}

interface TsProps {
  dataProvider: DefaultToolSettingsProvider;
  toolId: string;
}

interface TsState {
  toolId: string;
  valueMap: Map<string, DialogItem>;
}

/** Component to populate ToolSetting for ToolSettings properties
 */
class DefaultToolSettings extends React.Component<TsProps, TsState> {
  constructor(props: TsProps) {
    super(props);

    const state = DefaultToolSettings.getStateFromProps(props);
    /* istanbul ignore else */
    if (state)
      this.state = state;
  }

  /** Process Tool code's request to update one or more properties */
  private _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    const newValueMap = new Map<string, DialogItem>(this.state.valueMap);

    args.syncProperties.forEach((syncItem: DialogPropertySyncItem) => {
      Logger.logInfo(UiFramework.loggerCategory(this),
        `handleSyncToolSettingsPropertiesEvent - Tool updating '${syncItem.propertyName}' to value of ${(syncItem.value as DialogItemValue).value}`);

      const propertyRecord = newValueMap.get(syncItem.propertyName);
      /* istanbul ignore else */
      if (propertyRecord) {
        const updatedPropertyRecord: DialogItem = { value: syncItem.value, property: propertyRecord.property, isDisabled: syncItem.isDisabled, editorPosition: propertyRecord.editorPosition, lockProperty: propertyRecord.lockProperty };
        newValueMap.set(syncItem.propertyName, updatedPropertyRecord);
      }
    });
    this.setState({ valueMap: newValueMap });
  }

  public componentDidMount() {
    ToolUiManager.onSyncToolSettingsProperties.addListener(this._handleSyncToolSettingsPropertiesEvent);
  }

  public componentWillUnmount() {
    ToolUiManager.onSyncToolSettingsProperties.removeListener(this._handleSyncToolSettingsPropertiesEvent);
  }

  // istanbul ignore next
  private _handleCommit = (commit: PropertyUpdatedArgs): void => {
    const activeTool = IModelApp.toolAdmin.activeTool;
    if (!activeTool)
      return;

    const propertyName = commit.propertyRecord.property.name;

    // ToolSettings supports only primitive property types
    if (commit.newValue.valueFormat === PropertyValueFormat.Primitive && commit.propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
      const newPrimitiveValue = (commit.newValue as PrimitiveValue).value;
      if (newPrimitiveValue === (commit.propertyRecord.value as PrimitiveValue).value) {
        // tslint:disable-next-line:no-console
        // console.log(`Ignore commit - value of '${propertyName}' has not changed`);
        return;  // don't sync if no change occurred
      }

      const propertyRecord = this.state.valueMap.get(propertyName);
      if (propertyRecord) {
        const newValueMap = new Map<string, DialogItem>(this.state.valueMap);
        const updatedPropertyRecord: DialogItem = { value: commit.newValue as DialogItemValue, property: propertyRecord.property, isDisabled: propertyRecord.isDisabled, editorPosition: propertyRecord.editorPosition, lockProperty: propertyRecord.lockProperty };
        newValueMap.set(propertyName, updatedPropertyRecord);
        this.setState({ valueMap: newValueMap }, () => {
          const syncItem: DialogPropertySyncItem = { value: commit.newValue as DialogItemValue, propertyName };
          // tslint:disable-next-line:no-console
          // console.log(`Sending new value of ${ (commit.newValue as PrimitiveValue).value } for '${propertyName}' to tool`);
          activeTool.applyToolSettingPropertyChange(syncItem);
        });
      }
    }
  }

  private static getStateFromProps(props: TsProps): TsState {
    const valueMap = new Map<string, DialogItem>(props.dataProvider.valueMap);
    const { toolId } = props;
    return { toolId, valueMap };
  }

  private getEditor(rowRecord: DialogItem, isLock = false, setFocus = false): React.ReactNode {
    const item = this.state.valueMap.get(rowRecord.property.name);
    // istanbul ignore next
    if (!item)
      throw (new Error("No record found in value map for tool setting."));

    const record = this.props.dataProvider.getEditorRecord(item);

    const className = isLock ? "uifw-default-toolsettings-property-lock" : "uifw-default-toolsettings-editor";
    return (
      <div key={record.property.name} className={className} >
        <EditorContainer key={record.property.name} propertyRecord={record} setFocus={setFocus} onCommit={this._handleCommit} onCancel={() => { }} />
      </div>);
  }

  private generateRowWithButtonGroupEditors(row: TsRow, rowIndex: number): React.ReactNode {
    // istanbul ignore else
    if (1 === row.records.length) {
      return (
        <div key={row.records[0].property.name} className="uifw-default-toolsettings-inline-editor-group uifw-default-toolsettings-center-across-width">
          {this.getEditor(row.records[0])}
        </div>
      );
    }

    return (
      <div key={rowIndex} className="uifw-default-toolsettings-inline-editor-group uifw-default-toolsettings-center-across-width">
        <div className="uifw-default-toolsettings-inline-editor-group">
          {row.records.map((record) => this.getEditor(record))}
        </div>
      </div>
    );
  }

  private getPropertyId(record: DialogItem): string {
    return `toolSettingsProperty-${record.property.name}`;
  }

  private getPropertyLabelClass(record: DialogItem, isLeftmostRecord: boolean): string {
    const lockProperty = record.lockProperty ? this.state.valueMap.get(record.lockProperty.property.name) : null;

    return classnames(
      "uifw-default-toolsettings-label",
      (lockProperty && !(lockProperty.value as PrimitiveValue).value) && "uifw-toolSettings-label-disabled",
      isLeftmostRecord && "uifw-default-toolsettings-narrow-only-display",
      !isLeftmostRecord && "uifw-default-toolsettings-inline-label",
    );
  }

  private getPropertyLabel(rowRecord: DialogItem): string {
    return rowRecord.property.displayLabel ? rowRecord.property.displayLabel : rowRecord.property.name;
  }

  private getEditorLabel(rowRecord: DialogItem, isLeftmostRecord = false): React.ReactNode {
    const record = this.state.valueMap.get(rowRecord.property.name);
    // istanbul ignore next
    if (!record)
      throw (new Error("No record found in value map for tool setting."));

    return <label className={this.getPropertyLabelClass(record, isLeftmostRecord)} htmlFor={this.getPropertyId(rowRecord)}>{this.getPropertyLabel(rowRecord)}:</label>;
  }

  private getLeftLockAndLabel(rowRecord: DialogItem, multiplePropertiesOnRow: boolean): React.ReactNode {
    const record = this.state.valueMap.get(rowRecord.property.name);
    // istanbul ignore next
    if (!record)
      throw (new Error("No record found in value map for tool setting."));

    const lockEditor = (TsRow.hasAssociatedLockProperty(record)) ? this.getEditor(record.lockProperty!, true) : null;
    const label = (TsRow.editorWantsLabel(record)) ? this.getEditorLabel(record) : null;
    const classNames = multiplePropertiesOnRow ? "uifw-default-toolsettings-lock-and-label uifw-default-toolsettings-wide-only-display" : "uifw-default-toolsettings-lock-and-label";
    return (
      <div key={"lock-" + record.property.name} className={classNames}>
        {lockEditor}
        {label}
      </div>
    );
  }

  private getInlineLabelAndEditor(record: DialogItem, isLeftmostRecord: boolean): React.ReactNode {
    const label = (TsRow.editorWantsLabel(record)) ? this.getEditorLabel(record, isLeftmostRecord) : null;
    return (
      <div key={record.property.name} className="uifw-default-toolsettings-inline-label-and-editor">
        {label}
        {this.getEditor(record)}
      </div>
    );
  }

  private getRowWithMultipleEditors(row: TsRow): React.ReactNode {
    return <div className="uifw-default-toolsettings-inline-editor-group">
      {row.records.map((record: DialogItem, index: number) => this.getInlineLabelAndEditor(record, 0 === index))}
    </div>;
  }

  private getDivForRow(row: TsRow): React.ReactNode {
    if (1 === row.records.length)
      return this.getEditor(row.records[0]);
    return this.getRowWithMultipleEditors(row);
  }

  private getRow(row: TsRow, rowIndex: number): React.ReactNode {
    if (row.onlyContainButtonGroupEditors) {
      return this.generateRowWithButtonGroupEditors(row, rowIndex);
    } else {
      return (
        <React.Fragment key={rowIndex}>
          {this.getLeftLockAndLabel(row.records[0], row.records.length > 1)}
          {this.getDivForRow(row)}
        </React.Fragment>
      );
    }
  }

  public render(): React.ReactNode {
    const { rows } = this.props.dataProvider;
    // istanbul ignore next
    if (!rows)
      return null;

    return (
      <ToolSettingsContentContext.Consumer>
        {({ availableContentWidth }) => {
          const layoutMode = toLayoutMode(availableContentWidth);
          const className = classnames(
            "uifw-default-toolsettings-container",
            LayoutMode.Narrow === layoutMode && "uifw-default-toolsettings-narrow",
          );
          return (
            <div className="uifw-default-toolsettings-resizer-parent">
              <div className={className} >
                {rows.map((row, index) => this.getRow(row, index))}
              </div>
            </div>
          );
        }}
      </ToolSettingsContentContext.Consumer>
    );
  }
}

/** DataProvider that keep underlying data in sync with UI display */
class ToolSettingsDataProvider extends UiDataProvider {

  private _toolSettingsNode?: DefaultToolSettings;
  constructor() {
    super();
  }
  // istanbul ignore next
  public get toolSettingsNode(): DefaultToolSettings | undefined { return this._toolSettingsNode; }
  // istanbul ignore next
  public set toolSettingsNode(r: DefaultToolSettings | undefined) { this._toolSettingsNode = r; }

  public syncProperties(_props: DialogPropertySyncItem[]) {
  }

}
/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool.
 * @internal
 */
export class DefaultToolSettingsProvider extends ToolUiProvider {
  public rows: TsRow[] = [];
  public valueMap = new Map<string, DialogItem>();  // allows easy lookup of record given the property name

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const toolSettingsDP = new ToolSettingsDataProvider();

    // istanbul ignore else
    if (this.layoutToolSettingRows())
      this.toolSettingsNode = (
        <FrameworkVersionSwitch
          v1={<DefaultToolSettings dataProvider={this} key={Date.now()} toolId={FrontstageManager.activeToolId} />}
          v2={<WidgetPanelsDefaultToolSettings dataProvider={this} />}
        />
      );
    else
      this.toolSettingsNode = null;
    toolSettingsDP.toolSettingsNode = this.toolSettingsNode as DefaultToolSettings;
    this.dataProvider = toolSettingsDP;
  }

  private layoutToolSettingRows(): boolean {
    const toolSettingsProperties = ToolUiManager.toolSettingsProperties;

    toolSettingsProperties.forEach((record) => {
      this.valueMap.set(record.property.name, record);
      if (record.lockProperty)
        this.valueMap.set(record.lockProperty.property.name, record.lockProperty as DialogItem);

      const row = this.rows.find((value) => value.priority === record.editorPosition.rowPriority);
      if (row) {
        row.records.push(record);
      } else {
        this.rows.push(new TsRow(record.editorPosition.rowPriority, record));
      }
    });

    // sort rows
    this.rows.sort((a: TsRow, b: TsRow) => a.priority - b.priority);
    // sort records
    this.rows.forEach((row: TsRow) => row.records.sort((a: DialogItem, b: DialogItem) => a.editorPosition.columnIndex - b.editorPosition.columnIndex));
    return this.rows.length > 0;
  }

  public getEditorRecord = (dialogItem: DialogItem): PropertyRecord => {
    const propertyValue = { valueFormat: PropertyValueFormat.Primitive, value: dialogItem.value.value, displayValue: dialogItem.value.displayValue };
    const record = new PropertyRecord(propertyValue as PrimitiveValue, dialogItem.property);
    record.isDisabled = dialogItem.lockProperty ? !dialogItem.lockProperty.value.value as boolean : !!dialogItem.isDisabled;
    return record;
  }

  /* istanbul ignore next */
  public execute(): void {
  }

  public onInitialize(): void {
    // reload the data so it matches current values from tool and use it to refresh the toolSettingNode object reference.
    this.rows.length = 0;
    // istanbul ignore else
    if (this.layoutToolSettingRows())
      // the date is used as a key to ensure that React sees the node as "new" and in need of rendering every time it's updated
      this.toolSettingsNode = (
        <FrameworkVersionSwitch
          v1={<DefaultToolSettings dataProvider={this} key={Date.now()} toolId={FrontstageManager.activeToolId} />}
          v2={<WidgetPanelsDefaultToolSettings dataProvider={this} />}
        />
      );
    else
      this.toolSettingsNode = null;
  }
}

const toLayoutMode = (width: number) => {
  return (width < 250) ? LayoutMode.Narrow : LayoutMode.Wide;
};

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
