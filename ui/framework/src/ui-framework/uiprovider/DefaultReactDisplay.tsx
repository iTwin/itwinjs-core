/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiProvider
 */

import * as React from "react";
import * as classnames from "classnames";
import {
  DialogItemsManager, DialogItem, DialogItemValue, DialogItemSyncArgs, DialogRow, DialogPropertySyncItem, PrimitiveValue,
  PropertyValueFormat,
} from "@bentley/ui-abstract";
import { PropertyUpdatedArgs, EditorContainer } from "@bentley/ui-components";
import { Logger } from "@bentley/bentleyjs-core";

import { UiFramework } from "../UiFramework";

import "./DefaultReactDisplay.scss";

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
  readonly valueMap: Map<string, DialogItem>;
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
    const newValueMap = new Map<string, DialogItem>(this.state.valueMap);

    args.items.forEach((syncItem: DialogPropertySyncItem) => {
      Logger.logInfo(UiFramework.loggerCategory(this),
        `handleSyncPropertiesChangeEvent - UI updating '${syncItem.propertyName}' to value of ${(syncItem.value as DialogItemValue).value}`);
      if (syncItem.propertyName !== undefined) {
        const itemName = syncItem.propertyName;
        const dialogItem = newValueMap.get(itemName);
        /* istanbul ignore else */
        if (dialogItem) {
          const newLockProperty = (dialogItem.lockProperty ? newValueMap.get(dialogItem.lockProperty.property.name) : undefined);
          const updatedDialogItem: DialogItem = { value: dialogItem.value, property: dialogItem.property, editorPosition: dialogItem.editorPosition, isDisabled: syncItem.isDisabled, lockProperty: newLockProperty };
          newValueMap.set(itemName, updatedDialogItem);
          /** Update property items */
        }
      }
    });

    this.setState({ valueMap: newValueMap });
  }

  public componentDidMount() {
    this.itemsManager.onPropertiesChanged.addListener(this._handleSyncPropertiesChangeEvent);
  }

  public componentWillUnmount() {
    this.itemsManager.onPropertiesChanged.removeListener(this._handleSyncPropertiesChangeEvent);
  }

  public static hasAssociatedLockProperty(record: DialogItem): boolean {
    return !!record.lockProperty;
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

      const dialogItem = this.state.valueMap.get(propertyUpdateName);
      if (dialogItem) {
        const propertyRecord = commit.propertyRecord;
        const newValueMap = new Map<string, DialogItem>(this.state.valueMap);
        const updatedDialogItem = { value: commit.newValue as DialogItemValue, property: propertyRecord.property, editorPosition: dialogItem.editorPosition, isDisabled: dialogItem.isDisabled, lockProperty: dialogItem.lockProperty };
        newValueMap.set(propertyUpdateName, updatedDialogItem);
        this.setState({ valueMap: newValueMap }, () => {
          const syncItem: DialogPropertySyncItem = { value: commit.newValue as DialogItemValue, propertyName: propertyUpdateName, isDisabled: updatedDialogItem.isDisabled };
          this._itemsManager.applyUiPropertyChange (syncItem);
        });
      }
    }
  }

  private static getStateFromProps(props: DefaultDisplayProps): DefaultDisplayState {
    const valueMap = new Map<string, DialogItem>(props.itemsManager.valueMap);
    return { valueMap };
  }

  private getEditor(item: DialogItem, isLock = false, setFocus = false): React.ReactNode {
    const dialogItem = this.state.valueMap.get(item.property.name);
    // istanbul ignore next
    if (!dialogItem)
      throw (new Error("No record found in value map for dialog."));

    const record = DialogItemsManager.getPropertyRecord(item);

    if (!record)
      throw (new Error("Could not create property record for dialog item"));

    const className = isLock ? "uifw-default-property-lock" : "uifw-default-editor";
    return (
      <div key={record.property.name} className={className} >
        <EditorContainer key={record.property.name} propertyRecord={record} setFocus={setFocus} onCommit={this._handleCommit} onCancel={() => { }} />
      </div>);
  }

  private generateRowWithButtonGroupEditors(row: DialogRow, rowIndex: number): React.ReactNode {
    // istanbul ignore else
    if (1 === row.records.length) {
      return (
        <div key={row.records[0].property.name} className="uifw-default-inline-editor-group uifw-default-center-across-width">
          {this.getEditor(row.records[0])}
        </div>
      );
    }

    return (
      <div key={rowIndex} className="uifw-default-inline-editor-group uifw-default-center-across-width">
        <div className="uifw-default-inline-editor-group">
          {row.records.map((record) => this.getEditor(record))}
        </div>
      </div>
    );
  }

  private getPropertyId(record: DialogItem): string {
    return `dialogItemProperty-${record.property.name}`;
  }

  private getPropertyLabelClass(record: DialogItem, isLeftmostRecord: boolean): string {
    const lockProperty = record.lockProperty ? this.state.valueMap.get(record.lockProperty.property.name) : null;

    return classnames(
      "uifw-default-label",
      (lockProperty && !(lockProperty.value as PrimitiveValue).value) && "uifw-label-disabled",
      isLeftmostRecord && "uifw-default-narrow-only-display",
      !isLeftmostRecord && "uifw-default-inline-label",
    );
  }

  private getPropertyLabel(rowRecord: DialogItem): string {
    return rowRecord.property.displayLabel ? rowRecord.property.displayLabel : rowRecord.property.name;
  }

  private getEditorLabel(rowRecord: DialogItem, isLeftmostRecord = false): React.ReactNode {
    const record = this.state.valueMap.get(rowRecord.property.name);
    // istanbul ignore next
    if (!record)
      throw (new Error("No record found in value map for dialog item."));

    return <label className={this.getPropertyLabelClass(record, isLeftmostRecord)} htmlFor={this.getPropertyId(rowRecord)}>{this.getPropertyLabel(rowRecord)}:</label>;
  }

  private getLeftLockAndLabel(rowRecord: DialogItem, multiplePropertiesOnRow: boolean): React.ReactNode {
    const record = this.state.valueMap.get(rowRecord.property.name);
    // istanbul ignore next
    if (!record)
      throw (new Error("No record found in value map for dialog item."));

    const lockEditor = (DialogItemsManager.hasAssociatedLockProperty(record)) ? this.getEditor(record.lockProperty!, true) : null;
    const label = (DialogItemsManager.editorWantsLabel(record)) ? this.getEditorLabel(record) : null;
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
      {row.records.map((record: DialogItem, index: number) => this.getInlineLabelAndEditor(record, 0 === index))}
    </div>;
  }

  private getDivForRow(row: DialogRow): React.ReactNode {
    if (1 === row.records.length)
      return this.getEditor(row.records[0]);
    return this.getRowWithMultipleEditors(row);
  }

  private getRow(row: DialogRow, rowIndex: number): React.ReactNode {
    if (DialogItemsManager.onlyContainButtonGroupEditors(row)) {
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
    // istanbul ignore next
    if (this.itemsManager.rows.length === 0)
      return null;
    return (
      <div className="uifw-default-resizer-parent">
        <div className="uifw-default-container" >
          {this.itemsManager.rows.map((row: DialogRow, index: number) => this.getRow(row, index))}
        </div>
      </div>
    );
  }
}
