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
  PropertyEditorParams, PropertyEditorParamTypes, PropertyDescription,
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
  rows: TsRow[] | undefined;
}

const handleCommit = (commit: PropertyUpdatedArgs): void => {
  const activeTool = IModelApp.toolAdmin.activeTool;
  if (activeTool) {
    const syncItem: ToolSettingsPropertySyncItem = { value: commit.newValue as ToolSettingsValue, propertyName: commit.propertyRecord.property.name };
    activeTool.applyToolSettingPropertyChange(syncItem);
  }
};

/** Component to populate ToolSetting for ToolSettings properties */
export class DefaultToolSettings extends React.Component<TsProps> {
  private _numCols = 0;
  private _editors = new Map<string, React.ReactNode>();
  private _properties = new Map<string, PropertyDescription>();

  constructor(props: TsProps) {
    super(props);

    // sort rows and columns by priority.
    if (props.rows) {
      if (props.rows.length > 1)
        props.rows.sort((a, b) => a.priority - b.priority);
      props.rows.forEach((row) => {
        if (row.cols.length > 1)
          row.cols.sort((a, b) => a.priority - b.priority);
        if (row.cols.length > this._numCols) this._numCols = row.cols.length; {
          row.cols.forEach((col) => {
            this._properties.set(col.record.property.name, col.record.property);
          });
        }
      });
    }
  }

  private _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    let needToForceUpdate = false;
    args.syncProperties.forEach((syncItem: ToolSettingsPropertySyncItem) => {
      // create a new property editor for each property to sync
      const propertyDescription = this._properties.get(syncItem.propertyName);
      if (propertyDescription) {
        const updatedRecord = new PropertyRecord(syncItem.value, propertyDescription);
        const editor = this.getEditor(updatedRecord);
        if (editor) {
          // tslint:disable-next-line:no-console
          // console.log(`Default ToolSettings Provider - updating editor for ${updatedRecord.property.name} with new value ${JSON.stringify(updatedRecord.value)}`);
          this._editors.set(updatedRecord.property.name, editor);
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

  private getEditor(record: PropertyRecord): React.ReactNode {
    return <EditorContainer propertyRecord={record} onCommit={handleCommit} onCancel={() => { }} />;
  }

  private hasSuppressEditorLabelParam(record: PropertyRecord) {
    if (record.property.editor && record.property.editor.params)
      return record.property.editor.params.find((param: PropertyEditorParams) => param.type === PropertyEditorParamTypes.SuppressEditorLabel);

    return false;
  }

  private getCol(col: TsCol) {
    const label = !this.hasSuppressEditorLabelParam(col.record) ? col.record.property.displayLabel + ":" : null;
    let editor = this._editors.get(col.record.property.name);
    if (!editor) {
      editor = this.getEditor(col.record);
      this._editors.set(col.record.property.name, editor);
      // tslint:disable-next-line:no-console
      // console.log(`Created new editor for ${col.record.property.name}`);
    } else {
      // tslint:disable-next-line:no-console
      // console.log(`Using cached  editor for ${col.record.property.name}`);
    }
    return (
      <React.Fragment key={col.record.property.name}>
        <div key={col.record.property.name + "-label"}>
          {label}
        </div>
        <div key={col.record.property.name + "-editor"}>
          {editor}
        </div>
      </React.Fragment>
    );
  }

  private getRow(row: TsRow, index: number) {
    if (!row.cols) {
      return null;
    } else {
      return (
        <React.Fragment key={index}>
          {row.cols.map((col) => this.getCol(col))}
        </React.Fragment>
      );
    }
  }

  public render(): React.ReactNode {
    const { rows } = this.props;
    if (!rows) {
      return null;
    } else {
      const autoColArray = new Array<string>(this._numCols * 2); // * 2 because optional label for each editor
      autoColArray.fill("auto");
      const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: autoColArray.join(" "),
        gridGap: "4px",
      };

      return (
        <div style={gridStyle} className="toolSettingsRow" >
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
      this.toolSettingsNode = <DefaultToolSettings rows={this.rows} />;
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

  public execute(): void {
  }

  public onInitialize(): void {
    // reload the data so it match current values from tool
    this.rows.length = 0;
    this.getGridSpecsFromToolSettingProperties();
  }
}

ConfigurableUiManager.registerControl("DefaultToolSettings", DefaultToolSettingsProvider);
