/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiProvider
 */

import * as React from "react";
import classnames from "classnames";
import {
  DialogItemsManager, BaseDialogItem, DialogItem, DialogItemValue, DialogItemSyncArgs, DialogRow, DialogPropertySyncItem, PrimitiveValue,
  PropertyValueFormat,
  PropertyRecord,
} from "@bentley/ui-abstract";
import { PropertyUpdatedArgs, EditorContainer } from "@bentley/ui-components";
import { Logger } from "@bentley/bentleyjs-core";
import { ToolSettingsContentContext } from "../widgets/ToolSettingsContent";
import { UiFramework } from "../UiFramework";
import { ToolUiManager, SyncToolSettingsPropertiesEventArgs } from "../zones/toolsettings/ToolUiManager";

import "./DefaultReactDisplay.scss";

enum LayoutMode {
  Wide = 0,
  Narrow = 1,
}

/** Props to pass in to DefaultReactDisplay
 * @beta
 */
export interface DefaultDisplayProps {
  readonly itemsManager: DialogItemsManager;
}
/** State extracted from DialogItemsManager in DefaultReactDisplay
 * @beta
 */

interface DefaultDisplayState {
  readonly valueMap: Map<string, PropertyRecord>;
}

/** DefaultReactDisplay populates a React node with the items specified by the DialogItemsManager
 * @beta
 */
// istanbul ignore next
export class DefaultReactDisplay extends React.Component<DefaultDisplayProps, DefaultDisplayState> {
  private _itemsManager: DialogItemsManager;
  constructor(props: DefaultDisplayProps) {
    super(props);

    const state = DefaultReactDisplay.getStateFromProps(props);
    /* istanbul ignore else */
    if (state)
      this.state = state;
    this._itemsManager = props.itemsManager;
  }
  /** Get the Provider that generates and synchronizes UI for this Display */
  public get itemsManager(): DialogItemsManager { return this._itemsManager; }
  public set itemsManager(itemsManager: DialogItemsManager) { this._itemsManager = itemsManager; }

  /** Process request to update one or more properties */
  private _handleSyncPropertiesChangeEvent = (args: DialogItemSyncArgs): void => {
    const newValueMap = new Map<string, PropertyRecord>(this.state.valueMap);

    args.items.forEach((syncItem: DialogPropertySyncItem) => {
      Logger.logInfo(UiFramework.loggerCategory(this),
        `handleSyncPropertiesChangeEvent - UI updating '${syncItem.propertyName}' to value of ${(syncItem.value as DialogItemValue).value}`);
      if (syncItem.propertyName !== undefined) {
        const propertyRecord = newValueMap.get(syncItem.propertyName);
        /* istanbul ignore else */
        if (propertyRecord) {
          const newPropertyValue: PrimitiveValue = { valueFormat: PropertyValueFormat.Primitive, value: syncItem.value.value, displayValue: syncItem.value.displayValue };
          const updatedPropertyRecord: PropertyRecord = new PropertyRecord(newPropertyValue, propertyRecord.property);
          updatedPropertyRecord.isDisabled = syncItem.isDisabled;
          newValueMap.set(syncItem.propertyName, updatedPropertyRecord);
          /** Update property items */
        }
      }
    });

    this.setState({ valueMap: newValueMap });
  }

  private _handleSyncToolSettingsPropertiesEvent = (args: SyncToolSettingsPropertiesEventArgs): void => {
    const syncArgs: DialogItemSyncArgs = {items: args.syncProperties};
    this._handleSyncPropertiesChangeEvent (syncArgs);
  }
  public componentDidMount() {
    if (this._itemsManager.isToolSettingsManager())
      ToolUiManager.onSyncToolSettingsProperties.addListener(this._handleSyncToolSettingsPropertiesEvent);
    else
      this.itemsManager.onPropertiesChanged.addListener(this._handleSyncPropertiesChangeEvent);
  }

  public componentWillUnmount() {
    if (this._itemsManager.isToolSettingsManager())
      ToolUiManager.onSyncToolSettingsProperties.removeListener(this._handleSyncToolSettingsPropertiesEvent);
    else
      this.itemsManager.onPropertiesChanged.removeListener(this._handleSyncPropertiesChangeEvent);
  }

  public static hasAssociatedLockProperty(item: DialogItem): boolean {
    return !!item.lockProperty;
  }

  // istanbul ignore next
  private _handleCommit = (commit: PropertyUpdatedArgs): void => {
    const propertyUpdateName = commit.propertyRecord.property.name;

    // DialogItemsManager supports only primitive property types
    if (commit.newValue.valueFormat === PropertyValueFormat.Primitive && commit.propertyRecord.value.valueFormat === PropertyValueFormat.Primitive) {
      const newPrimitiveValue = (commit.newValue as PrimitiveValue).value;
      if (newPrimitiveValue === (commit.propertyRecord.value as PrimitiveValue).value) {
        // tslint:disable-next-line:no-console
        // console.log(`Ignore commit - value of '${propertyUpdateName}' has not changed`);
        return;  // don't sync if no change occurred
      }

      const propertyRecord = this.state.valueMap.get(propertyUpdateName);
      if (propertyRecord) {
        const newValue: PrimitiveValue = commit.newValue;
        const newPropertyRecord = new PropertyRecord (newValue, commit.propertyRecord.property);
        const newValueMap = new Map<string, PropertyRecord>(this.state.valueMap);
        newValueMap.set(propertyUpdateName, newPropertyRecord);
        this.setState({ valueMap: newValueMap }, () => {
          const syncItem: DialogPropertySyncItem = { value: commit.newValue as DialogItemValue, propertyName: propertyUpdateName, isDisabled: newPropertyRecord.isDisabled };
          this._itemsManager.applyUiPropertyChange(syncItem);
        });
      }
    }
  }

  private static getStateFromProps(props: DefaultDisplayProps): DefaultDisplayState {
    const valueMap = new Map<string, PropertyRecord>(props.itemsManager.valueMap);
    return { valueMap };
  }

  private getEditor(item: BaseDialogItem, isLock = false, setFocus = false): React.ReactNode {
    const propertyRecord = this.state.valueMap.get(item.property.name);
    // istanbul ignore next
    if (!propertyRecord)
      throw (new Error("No record found in value map for dialog."));

    const className = isLock ? "uifw-default-property-lock" : "uifw-default-editor";
    return (
      <div key={item.property.name} className={className} >
        <EditorContainer key={item.property.name} propertyRecord={propertyRecord} setFocus={setFocus} onCommit={this._handleCommit} onCancel={() => { }} />
      </div>);
  }

  private generateRowWithButtonGroupEditors(row: DialogRow, rowIndex: number): React.ReactNode {
    // istanbul ignore else
    if (1 === row.items.length) {
      return (
        <div key={row.items[0].property.name} className="uifw-default-inline-editor-group uifw-default-center-across-width">
          {this.getEditor(row.items[0])}
        </div>
      );
    }

    return (
      <div key={rowIndex} className="uifw-default-inline-editor-group uifw-default-center-across-width">
        <div className="uifw-default-inline-editor-group">
          {row.items.map((item) => this.getEditor(item))}
        </div>
      </div>
    );
  }

  private getPropertyId(item: BaseDialogItem): string {
    return `dialogItemProperty-${item.property.name}`;
  }

  private getPropertyLabelClass(item: DialogItem, isLeftmostRecord: boolean): string {
    const lockProperty = item.lockProperty ? this.state.valueMap.get(item.lockProperty.property.name) : null;

    return classnames(
      "uifw-default-label",
      (lockProperty && !(lockProperty.value as PrimitiveValue).value) && "uifw-label-disabled",
      isLeftmostRecord && "uifw-default-narrow-only-display",
      !isLeftmostRecord && "uifw-default-inline-label",
    );
  }

  private getPropertyLabel(rowItem: DialogItem): string {
    return rowItem.property.displayLabel ? rowItem.property.displayLabel : rowItem.property.name;
  }

  private getEditorLabel(rowItem: DialogItem, isLeftmostRecord = false): React.ReactNode {
    const record = this.state.valueMap.get(rowItem.property.name);
    // istanbul ignore next
    if (!record)
      throw (new Error("No record found in value map for dialog item."));

    return <label className={this.getPropertyLabelClass(rowItem, isLeftmostRecord)} htmlFor={this.getPropertyId(rowItem)}>{this.getPropertyLabel(rowItem)}:</label>;
  }

  private getLeftLockAndLabel(rowItem: DialogItem, multiplePropertiesOnRow: boolean): React.ReactNode {
    const record = this.state.valueMap.get(rowItem.property.name);
    // istanbul ignore next
    if (!record)
      throw (new Error("No record found in value map for dialog item."));

    const lockEditor = (DialogItemsManager.hasAssociatedLockProperty(rowItem)) ? this.getEditor(rowItem.lockProperty!, true) : null;
    const label = (DialogItemsManager.editorWantsLabel(rowItem)) ? this.getEditorLabel(rowItem) : null;
    const classNames = multiplePropertiesOnRow ? "uifw-default-lock-and-label uifw-default-wide-only-display" : "uifw-default-lock-and-label";
    return (
      <div key={"lock-" + record.property.name} className={classNames}>
        {lockEditor}
        {label}
      </div>
    );
  }

  private getInlineLabelAndEditor(record: DialogItem, isLeftmostRecord: boolean): React.ReactNode {
    const label = (DialogItemsManager.editorWantsLabel(record)) ? this.getEditorLabel(record, isLeftmostRecord) : null;
    return (
      <div key={record.property.name} className="uifw-default-inline-label-and-editor">
        {label}
        {this.getEditor(record)}
      </div>
    );
  }

  private getRowWithMultipleEditors(row: DialogRow): React.ReactNode {
    return <div className="uifw-default-inline-editor-group">
      {row.items.map((item: DialogItem, index: number) => this.getInlineLabelAndEditor(item, 0 === index))}
    </div>;
  }

  private getDivForRow(row: DialogRow): React.ReactNode {
    if (1 === row.items.length)
      return this.getEditor(row.items[0]);
    return this.getRowWithMultipleEditors(row);
  }

  private getRow(row: DialogRow, rowIndex: number): React.ReactNode {
    if (DialogItemsManager.onlyContainButtonGroupEditors(row)) {
      return this.generateRowWithButtonGroupEditors(row, rowIndex);
    } else {
      return (
        <React.Fragment key={rowIndex}>
          {this.getLeftLockAndLabel(row.items[0], row.items.length > 1)}
          {this.getDivForRow(row)}
        </React.Fragment>
      );
    }
  }
  public render(): React.ReactNode {
    // istanbul ignore next
    if (this.itemsManager.rows.length === 0)
      return null;
    return (
        <ToolSettingsContentContext.Consumer>
        {({ availableContentWidth }) => {
          const layoutMode = toLayoutMode(availableContentWidth);
          const className = classnames(
            "uifw-default-container",
            LayoutMode.Narrow === layoutMode && "uifw-default-narrow",
          );
          return (
            <div className="uifw-default-resizer-parent">
              <div className={className} >
                {this.itemsManager.rows.map((row: DialogRow, index: number) => this.getRow(row, index))}
              </div>
            </div>
          );
        }}
      </ToolSettingsContentContext.Consumer>
    );
  }
}
const toLayoutMode = (width: number) => {
  return (width < 250 && width > 0) ? LayoutMode.Narrow : LayoutMode.Wide;
};
