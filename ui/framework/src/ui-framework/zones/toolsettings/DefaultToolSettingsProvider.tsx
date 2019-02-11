/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import * as React from "react";

// cSpell:Ignore configurableui
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ToolUiProvider } from "./ToolUiProvider";
import "./DefaultToolSettingsProvider.scss";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { FrontstageManager, SyncToolSettingsPropertiesEventArgs } from "../../frontstage/FrontstageManager";
import { PropertyUpdatedArgs, EditorContainer } from "@bentley/ui-components";
import {
  IModelApp, PropertyRecord, ToolSettingsPropertyRecord, ToolSettingsPropertySyncItem, ToolSettingsValue,
  PropertyEditorParams, PropertyEditorParamTypes, PropertyDescription, PrimitiveValue, PropertyValueFormat, EditorPosition,
} from "@bentley/imodeljs-frontend";

class TsCol {
  constructor(public readonly priority: number, public record: ToolSettingsPropertyRecord, public columnSpan = 0) { }
}

class TsRow {
  public priority = 0;
  public cols: TsCol[] = [];
  constructor(priority: number) {
    this.priority = priority;
  }
}

interface TsProps {
  toolId: string;
  rows: TsRow[] | undefined;
}

const handleCommit = (commit: PropertyUpdatedArgs): void => {
  const activeTool = IModelApp.toolAdmin.activeTool;
  if (activeTool) {
    const syncItem: ToolSettingsPropertySyncItem = { value: commit.newValue as ToolSettingsValue, propertyName: commit.propertyRecord.property.name };
    activeTool.applyToolSettingPropertyChange(syncItem);
  }
};

interface TsState {
  toolId: string;
  numCols: number;
  properties: Map<string, PropertyDescription>;
  editors: Map<string, React.ReactNode>;
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

  private _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    let needToForceUpdate = false;
    args.syncProperties.forEach((syncItem: ToolSettingsPropertySyncItem) => {
      // create a new property editor for each property to sync
      const propertyDescription = this.state.properties.get(syncItem.propertyName);
      if (propertyDescription) {
        const updatedRecord = new PropertyRecord(syncItem.value, propertyDescription);
        const editor = this.getEditor(updatedRecord);
        if (editor) {
          // tslint:disable-next-line:no-console
          // console.log(`Default ToolSettings Provider - updating editor for ${updatedRecord.property.name} with new value ${JSON.stringify(updatedRecord.value)}`);
          this.state.editors.set(updatedRecord.property.name, editor);
          needToForceUpdate = true;
        }
      }
    });
    if (needToForceUpdate)
      this.forceUpdate();
  }

  public componentDidMount() {
    FrontstageManager.onSyncToolSettingsProperties.addListener(this._handleSyncToolSettingsPropertiesEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.onSyncToolSettingsProperties.removeListener(this._handleSyncToolSettingsPropertiesEvent);
  }

  /** @hidden */
  public componentDidUpdate() {
    // required to ensure the state is kept in sync with props, since props may be updated from outside the type editor. For example from interactive tool.
    const state = DefaultToolSettings.getStateFromProps(this.props);
    // istanbul ignore else
    if (state && (this.state.toolId !== state.toolId || this.state.numCols !== state.numCols)) {
      this.setState(state);
    }
  }

  private static _placeholderCellName = "__";
  private static _blankDescription: PropertyDescription = {
    displayLabel: DefaultToolSettings._placeholderCellName,
    name: DefaultToolSettings._placeholderCellName,
    typename: "string",
  };

  private static _blankValue: PrimitiveValue = {
    valueFormat: PropertyValueFormat.Primitive,
  };

  private static getStateFromProps(props: TsProps): TsState | null {
    const toolId = props.toolId;
    const properties = new Map<string, PropertyDescription>();
    let numCols = 0;
    const editors = new Map<string, React.ReactNode>();

    const blankCellRecord = new ToolSettingsPropertyRecord(DefaultToolSettings._blankValue, DefaultToolSettings._blankDescription, { rowPriority: 0, columnPriority: 0 } as EditorPosition);

    // sort rows and columns by priority.
    /* istanbul ignore else */
    if (props.rows) {
      /* istanbul ignore else */
      if (props.rows.length > 1)
        props.rows.sort((a, b) => a.priority - b.priority);
      props.rows.forEach((row) => {
        if (row.cols.length > 1)
          row.cols.sort((a, b) => a.priority - b.priority);
        /* istanbul ignore else */
        if (row.cols.length > numCols) numCols = row.cols.length; {
          row.cols.forEach((col) => {
            properties.set(col.record.property.name, col.record.property);
          });
        }
      });

      // add a placeholder entries so each cell in the grid has something defined
      props.rows.forEach((row) => {
        /* istanbul ignore else */
        if (row.cols.length < numCols)
          row.cols.push(new TsCol(-1, blankCellRecord));
      });

      return { properties, toolId, numCols, editors };
    }

    return null;
  }

  private getEditor(record: PropertyRecord, setFocus = false): React.ReactNode {
    return <EditorContainer propertyRecord={record} setFocus={setFocus} onCommit={handleCommit} onCancel={() => { }} />;
  }

  private hasSuppressEditorLabelParam(record: PropertyRecord) {
    /* istanbul ignore else */
    if (record.property.editor && record.property.editor.params)
      return record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.SuppressEditorLabel);

    return false;
  }

  private getCol(col: TsCol, rowIndex: number, colIndex: number) {
    if (col.record!.property.name === DefaultToolSettings._placeholderCellName) {
      // build placeholder elements for label and editor
      return (
        <React.Fragment key={`${rowIndex.toString()}-${colIndex.toString()}`}>
          <span></span>
          <span></span>
        </React.Fragment>
      );
    }

    const label = !this.hasSuppressEditorLabelParam(col.record) ? col.record.property.displayLabel + ":" : <span></span>;
    let editor = this.state.editors.get(col.record.property.name);
    if (!editor) {
      editor = this.getEditor(col.record);
      this.state.editors.set(col.record.property.name, editor);
      // tslint:disable-next-line:no-console
      // console.log(`Created new editor for ${col.record.property.name}`);
    } else {
      // tslint:disable-next-line:no-console
      // console.log(`Using cached  editor for ${col.record.property.name}`);
    }
    const labelStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
    };
    return (
      <React.Fragment key={col.record.property.name}>
        <div style={labelStyle} key={col.record.property.name + "-label"}>
          {label}
        </div>
        <div key={col.record.property.name + "-editor"}>
          {editor}
        </div>
      </React.Fragment>
    );
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
      const autoColArray = new Array<string>(this.state.numCols * 2); // * 2 because optional label for each editor
      autoColArray.fill("auto");
      const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: autoColArray.join(" "),
        gridRowGap: "4px",
        gridColumnGap: "6px",
      };

      return (
        <div style={gridStyle} className="toolSettingsContainer" >
          {rows.map((row, index) => this.getRow(row, index))}
        </div>
      );
    }
  }
}

/** ToolUiProvider class that informs ConfigurableUi that Tool Settings are provided for the specified tool. */
export class DefaultToolSettingsProvider extends ToolUiProvider {
  public rows: TsRow[] = [];

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    const hasProperties = this.getGridSpecsFromToolSettingProperties();
    if (hasProperties)
      this.toolSettingsNode = <DefaultToolSettings rows={this.rows} toolId={FrontstageManager.activeToolId} />;
    else
      this.toolSettingsNode = null;
  }

  private getGridSpecsFromToolSettingProperties(): boolean {
    FrontstageManager.toolsettingsProperties.forEach((record) => {
      let row = this.rows.find((value) => value.priority === record.editorPosition.rowPriority);
      if (!row) {
        row = new TsRow(record.editorPosition.rowPriority);
        this.rows.push(row);
      }

      row.cols.push(new TsCol(record.editorPosition.columnPriority, record));
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
