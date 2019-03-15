/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as React from "react";

// cSpell:Ignore configurableui
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";
import "./DefaultToolSettingsProvider.scss";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { FrontstageManager } from "../../frontstage/FrontstageManager";
import { ToolUiManager, SyncToolSettingsPropertiesEventArgs } from "../toolsettings/ToolUiManager";
import { PropertyUpdatedArgs, EditorContainer } from "@bentley/ui-components";
import {
  IModelApp, PropertyRecord, ToolSettingsPropertyRecord, ToolSettingsPropertySyncItem, ToolSettingsValue,
  PropertyEditorParams, PropertyEditorParamTypes, SuppressLabelEditorParams, PrimitiveValue, PropertyValueFormat,
} from "@bentley/imodeljs-frontend";

class TsLabel {
  constructor(public readonly label: string, public isDisabled?: boolean) { }
}

enum ColumnType {
  Label,
  Record,
  RecordSpan,
  Empty,
}

class TsCol {
  public type: ColumnType = ColumnType.Empty;
  public name: string = "";
  public columnSpan = 1;
  constructor(readonly columnIndex: number) { }
}

class TsRow {
  public priority = 0;
  public cols: TsCol[] = [];
  constructor(priority: number, numColumns: number) {
    this.priority = priority;
    // seed columns and mark them all as empty
    for (let i = 0; i < numColumns; i++) {
      this.cols.push(new TsCol(i));
    }
  }
}

interface TsProps {
  toolId: string;
  rows: TsRow[];
  numCols: number;
  valueMap: Map<string, ToolSettingsPropertyRecord>;
  labelMap: Map<string, TsLabel>;
}

interface TsState {
  toolId: string;
  numCols: number;
  valueMap: Map<string, ToolSettingsPropertyRecord>;
  labelMap: Map<string, TsLabel>;
}

/** Component to populate ToolSetting for ToolSettings properties */
export class DefaultToolSettings extends React.Component<TsProps, TsState> {
  constructor(props: TsProps) {
    super(props);

    const state = DefaultToolSettings.getStateFromProps(props);
    /* istanbul ignore else */
    if (state)
      this.state = state;
  }

  /** Process Tool code's request to update one or more properties */
  private _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    let needToForceUpdate = false;
    args.syncProperties.forEach((syncItem: ToolSettingsPropertySyncItem) => {
      // tslint:disable-next-line:no-console
      // (`[_handleSyncToolSettingsPropertiesEvent] Tool updating '${syncItem.propertyName}' to value of ${(syncItem.value as ToolSettingsValue).value}`);
      const colValue = this.state.valueMap.get(syncItem.propertyName);
      if (colValue) {
        const updatedPropertyRecord = ToolSettingsPropertyRecord.clone(colValue, syncItem.value as ToolSettingsValue);
        updatedPropertyRecord.isDisabled = syncItem.isDisabled;
        this.state.valueMap.set(syncItem.propertyName, updatedPropertyRecord);

        // keep label enable state in sync with property editor
        const labelCol = this.state.labelMap.get(syncItem.propertyName);
        if (labelCol)
          labelCol.isDisabled = syncItem.isDisabled;
        needToForceUpdate = true;
      }
    });

    if (needToForceUpdate) {
      this.forceUpdate();
    }
  }

  public componentDidMount() {
    ToolUiManager.onSyncToolSettingsProperties.addListener(this._handleSyncToolSettingsPropertiesEvent);
  }

  public componentWillUnmount() {
    ToolUiManager.onSyncToolSettingsProperties.removeListener(this._handleSyncToolSettingsPropertiesEvent);
  }

  private _handleCommit = (commit: PropertyUpdatedArgs): void => {
    const activeTool = IModelApp.toolAdmin.activeTool;
    if (activeTool) {
      const propertyName = commit.propertyRecord.property.name;

      // ToolSettings supports only primitive property types
      if (commit.newValue.valueFormat === PropertyValueFormat.Primitive && commit.propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
        const newPrimitiveValue = (commit.newValue as PrimitiveValue).value;
        const currentPrimitiveValue = (commit.propertyRecord.value as PrimitiveValue).value;
        if (newPrimitiveValue === currentPrimitiveValue) {
          // tslint:disable-next-line:no-console
          // console.log(`Ignore commit - value of '${propertyName}' has not changed`);
          return;  // don't sync if no change occurred
        }

        const colValue = this.state.valueMap.get(propertyName);
        if (colValue) {
          const updatedPropertyRecord = ToolSettingsPropertyRecord.clone(colValue, commit.newValue as ToolSettingsValue);
          this.state.valueMap.set(propertyName, updatedPropertyRecord);
          // tslint:disable-next-line:no-console
          // console.log(`Updating data in column - value=${(commit.newValue as PrimitiveValue).value} property='${propertyName}'`);
        }

        // if we updated state then force child components to update
        this.forceUpdate(() => {
          // send change to active tool
          const syncItem: ToolSettingsPropertySyncItem = { value: commit.newValue as ToolSettingsValue, propertyName };
          // tslint:disable-next-line:no-console
          // console.log(`Sending new value of ${(commit.newValue as PrimitiveValue).value} for '${propertyName}' to tool`);
          activeTool.applyToolSettingPropertyChange(syncItem);
        });
      }
    }
  }

  /** @hidden */
  public componentDidUpdate(prevProps: TsProps, _prevState: TsState) {
    // if the props have changed then we need to update the state
    const prevRecord = prevProps.rows;
    const currentRecord = this.props.rows;
    let refreshRequired = false;
    if (prevRecord !== currentRecord)
      refreshRequired = true;

    if (refreshRequired) {
      const state = DefaultToolSettings.getStateFromProps(this.props);
      if (state) {
        this.setState(state);
        return;
      }
    }
  }

  private static getStateFromProps(props: TsProps): TsState {
    const { toolId, valueMap, labelMap, numCols } = props;
    return { toolId, numCols, valueMap, labelMap };
  }

  private getEditor(record: PropertyRecord, setFocus = false): React.ReactNode {
    return <EditorContainer propertyRecord={record} setFocus={setFocus} onCommit={this._handleCommit} onCancel={() => { }} />;
  }

  private getCol(col: TsCol, rowIndex: number, colIndex: number) {
    if (col.type === ColumnType.Empty) {
      return ( // return a <span> as a placeholder elements
        <React.Fragment key={`${rowIndex.toString()}-${colIndex.toString()}`}>
          <span key={`${rowIndex.toString()}-${colIndex.toString()}`}></span>
        </React.Fragment>
      );
    }

    const labelStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
    };

    if (col.type === ColumnType.Label) {
      const labelData = this.state.labelMap.get(col.name);
      if (labelData) {
        const className = labelData.isDisabled ? "uifw-toolSettings-label-disabled" : undefined;
        return ( // return a <span> containing a label
          <span style={labelStyle} className={className} key={`${rowIndex.toString()}-${colIndex.toString()}`}>
            {labelData.label}:
          </span>
        );
      }
    }

    if (col.type === ColumnType.RecordSpan)
      return null;

    if (col.type === ColumnType.Record) {
      const record = this.state.valueMap.get(col.name);
      if (record) {
        const editor = this.getEditor(record);
        let spanStyle: React.CSSProperties | undefined;
        if (record.editorPosition.columnSpan && record.editorPosition.columnSpan > 1) {
          spanStyle = {
            gridColumn: `span ${record.editorPosition.columnSpan}`,
          } as React.CSSProperties;
        }

        return (
          <div key={col.name} style={spanStyle}>
            {editor}
          </div>
        );
      }
    }

    return null;
  }

  private getRow(row: TsRow, rowIndex: number) {
    if (!row.cols) {
      return null;
    } else {
      return (
        <React.Fragment key={rowIndex}>
          {row.cols.map((col, colIndex: number) => this.getCol(col, rowIndex, colIndex))}
        </React.Fragment>
      );
    }
  }

  public render(): React.ReactNode {
    const { rows } = this.props;
    if (!rows) {
      return null;
    } else {
      const autoColArray = new Array<string>(this.state.numCols);
      autoColArray.fill("auto");
      const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: autoColArray.join(" "),
        gridRowGap: "4px",
        gridColumnGap: "6px",
      };

      return (
        <div style={gridStyle} className="uifw-toolSettingsContainer" >
          {rows.map((row, index) => this.getRow(row, index))}
        </div>
      );
    }
  }
}

/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool. */
export class DefaultToolSettingsProvider extends ToolUiProvider {
  public rows: TsRow[] = [];
  public valueMap = new Map<string, ToolSettingsPropertyRecord>();
  public labelMap = new Map<string, TsLabel>();
  private _numCols = 0;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (this.getGridSpecsFromToolSettingProperties())
      this.toolSettingsNode = <DefaultToolSettings rows={this.rows} numCols={this._numCols} valueMap={this.valueMap} labelMap={this.labelMap} toolId={FrontstageManager.activeToolId} />;
    else
      this.toolSettingsNode = null;
  }

  // assumes columns are sorted by index.
  private getRequiredNumberOfColumns(records: ToolSettingsPropertyRecord[]): number {
    if (!records || records.length < 1)
      return 0;

    let maxIndex = 0;
    records.forEach((record) => {
      const colIndex = record.editorPosition.columnIndex + (record.editorPosition.columnSpan ? record.editorPosition.columnSpan : 1) - 1;
      if (maxIndex < colIndex)
        maxIndex = colIndex;
    });
    return maxIndex + 1;
  }

  private hasSuppressEditorLabelParam(record: ToolSettingsPropertyRecord): SuppressLabelEditorParams | undefined {
    /* istanbul ignore else */
    if (record.property.editor && record.property.editor.params)
      return record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.SuppressEditorLabel) as SuppressLabelEditorParams;
    return undefined;
  }

  private setEditorLabel(row: TsRow, record: ToolSettingsPropertyRecord, propertyName: string): void {

    const suppressLabelEditorParams = this.hasSuppressEditorLabelParam(record);
    if (suppressLabelEditorParams && suppressLabelEditorParams.suppressLabelPlaceholder)
      return;

    const labelCol = record.editorPosition.columnIndex - 1;
    const label = (undefined === suppressLabelEditorParams) ? record.property.displayLabel : "";
    if (labelCol < 0) {
      // tslint:disable-next-line:no-console
      console.log(`Default ToolSettings Provider - invalid label column for ${propertyName}`);
      return;
    }

    if (row.cols[labelCol].type !== ColumnType.Empty) {
      // tslint:disable-next-line:no-console
      console.log(`Default ToolSettings Provider - label column for ${propertyName} is already in use`);
      return;
    }

    row.cols[labelCol].name = propertyName;
    this.labelMap.set(propertyName, new TsLabel(label, record.isDisabled));
    row.cols[labelCol].type = ColumnType.Label;
  }

  private setPropertyRecord(row: TsRow, record: ToolSettingsPropertyRecord): void {
    const editCol = record.editorPosition.columnIndex;

    if (row.cols[editCol].type !== ColumnType.Empty) {
      // tslint:disable-next-line:no-console
      console.log(`Default ToolSettings Provider - label column for ${record.property.name} is already in use`);
      return;
    }

    const recordName = record.property.name;
    row.cols[editCol].type = ColumnType.Record;
    row.cols[editCol].name = recordName;
    this.valueMap.set(recordName, record);

    let columnSpan = 1;
    if (record.editorPosition.columnSpan)
      columnSpan = record.editorPosition.columnSpan;

    for (let i = 1; i < columnSpan; i++)
      row.cols[editCol + i].type = ColumnType.RecordSpan;

    this.setEditorLabel(row, record, recordName);
  }

  private getGridSpecsFromToolSettingProperties(): boolean {
    const toolSettingsProperties = ToolUiManager.toolSettingsProperties;

    this._numCols = this.getRequiredNumberOfColumns(toolSettingsProperties);
    if (this._numCols < 1)
      return false;

    toolSettingsProperties.forEach((record) => {
      let row = this.rows.find((value) => value.priority === record.editorPosition.rowPriority);
      if (!row) {
        row = new TsRow(record.editorPosition.rowPriority, this._numCols);
        this.rows.push(row);
      }

      this.setPropertyRecord(row, record);
    });

    return this.rows.length > 0;
  }

  /* istanbul ignore next */
  public execute(): void {
  }

  public onInitialize(): void {
    // reload the data so it matches current values from tool
    this.rows.length = 0;
    this.getGridSpecsFromToolSettingProperties();
  }
}

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
