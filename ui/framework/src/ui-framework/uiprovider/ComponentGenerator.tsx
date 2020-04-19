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
  DialogItemsManager, BaseDialogItem, DialogItem, DialogRow, SyncPropertiesChangeEventArgs, PropertyRecord, PropertyValueFormat, DialogPropertySyncItem, DialogItemValue,
} from "@bentley/ui-abstract";
import { PropertyUpdatedArgs, EditorContainer } from "@bentley/ui-components";
import { ToolSettingsEntry } from "../widget-panels/ToolSettings";

import "./DefaultDialogGridContainer.scss";
import { assert } from "@bentley/ui-ninezone";

function EditorLabel({ itemsManager, item, isLeftmostRecord }: { itemsManager: DialogItemsManager, item: DialogItem, isLeftmostRecord?: boolean }) {
  const [isDisabled, setIsDisabled] = React.useState(!!item.isDisabled);

  const displayLabel = React.useMemo(() => item.property.displayLabel ? item.property.displayLabel : item.property.name, [item]);
  const propertyId = React.useMemo(() => `dialogItemProperty-${item.property.name}`, [item]);

  // listen for tool sync property events and update the isDisabled state
  React.useEffect(() => {
    const handleSync = (args: SyncPropertiesChangeEventArgs) => {
      const mySyncItem = args.properties.find((syncItem: DialogPropertySyncItem) => syncItem.propertyName === item.property.name);
      // istanbul ignore next
      if (mySyncItem) {
        setIsDisabled(!!mySyncItem.isDisabled);
      }
    };
    itemsManager.onSyncPropertiesChangeEvent.addListener(handleSync);
    return () => {
      itemsManager.onSyncPropertiesChangeEvent.removeListener(handleSync);
    };
  }, [itemsManager, item]);

  // istanbul ignore next
  const className = classnames(
    "uifw-default-label",
    isDisabled && "uifw-label-disabled",
    !!isLeftmostRecord && "uifw-default-narrow-only-display",
    !isLeftmostRecord && "uifw-default-inline-label",
  );
  return <label className={className} htmlFor={propertyId}>{displayLabel}:</label>;
}

function PropertyEditor({ itemsManager, record, isLock, setFocus }: { itemsManager: DialogItemsManager, record: PropertyRecord, isLock?: boolean, setFocus?: boolean }) {
  const [propertyRecord, setPropertyRecord] = React.useState(record);

  // monitor tool for sync UI events
  React.useEffect(() => {
    const handleSync = (args: SyncPropertiesChangeEventArgs) => {
      const mySyncItem = args.properties.find((syncItem: DialogPropertySyncItem) => syncItem.propertyName === record.property.name);
      if (mySyncItem) {
        const newPropertyValue = propertyRecord.copyWithNewValue({ value: mySyncItem.value.value, valueFormat: PropertyValueFormat.Primitive, displayValue: mySyncItem.value.displayValue });
        newPropertyValue.isDisabled = mySyncItem.isDisabled;
        setPropertyRecord(newPropertyValue);
      }
    };
    itemsManager.onSyncPropertiesChangeEvent.addListener(handleSync);
    return () => {
      itemsManager.onSyncPropertiesChangeEvent.removeListener(handleSync);
    };
  }, [itemsManager, propertyRecord, record.property.name]);

  const className = React.useMemo(() => isLock ? "uifw-default-property-lock" : "uifw-default-editor", [isLock]);
  const handleCommit = React.useCallback((commit: PropertyUpdatedArgs) => {
    // DialogItemsManager supports only primitive property types
    // istanbul ignore next
    assert(commit.newValue.valueFormat === PropertyValueFormat.Primitive && commit.propertyRecord.value.valueFormat === PropertyValueFormat.Primitive);
    const newPropertyValue = propertyRecord.copyWithNewValue(commit.newValue);
    const syncItem: DialogPropertySyncItem = { value: commit.newValue as DialogItemValue, propertyName: record.property.name, isDisabled: newPropertyValue.isDisabled };
    itemsManager.applyUiPropertyChange(syncItem);
    setPropertyRecord(newPropertyValue);
  }, [propertyRecord, itemsManager, record.property.name]);

  return (
    <div key={record.property.name} className={className} >
      <EditorContainer key={record.property.name} propertyRecord={propertyRecord!} setFocus={setFocus} onCommit={handleCommit} onCancel={() => { }} />
    </div>);
}

/** Utility methods to generate react ui from DialogRow specs
 * @internal
 */
export class ComponentGenerator {

  private _itemsManager: DialogItemsManager;
  constructor(itemsManager: DialogItemsManager) {
    this._itemsManager = itemsManager;
  }

  private getEditor(item: BaseDialogItem, isLock = false, setFocus = false): React.ReactNode {
    const record = DialogItemsManager.getPropertyRecord(item);
    return <PropertyEditor key={item.property.name} itemsManager={this._itemsManager} record={record} isLock={isLock} setFocus={setFocus} />;
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

  private generateEntryWithButtonGroupEditors(row: DialogRow, rowIndex: number): ToolSettingsEntry {
    // istanbul ignore else
    if (1 === row.items.length) {
      return (
        {
          labelNode: "",
          editorNode:
            <div key={row.items[0].property.name} className="uifw-default-inline-editor-group uifw-default-center-across-width">
              {this.getEditor(row.items[0])}
            </div>,
        }
      );
    }

    return (
      {
        labelNode: "",
        editorNode:
          <div key={rowIndex} className="uifw-default-inline-editor-group uifw-default-center-across-width">
            <div className="uifw-default-inline-editor-group">
              {row.items.map((item) => this.getEditor(item))}
            </div>
          </div>,
      }
    );
  }

  private getEditorLabel(item: DialogItem, isLeftmostRecord = false): React.ReactNode {
    return <EditorLabel itemsManager={this._itemsManager} item={item} isLeftmostRecord={isLeftmostRecord} />;
  }

  private getLeftLockAndLabel(rowItem: DialogItem, multiplePropertiesOnRow: boolean): React.ReactNode {
    const record = DialogItemsManager.getPropertyRecord(rowItem);
    // istanbul ignore next
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

  private getInlineLabelAndEditor(item: DialogItem, isLeftmostRecord: boolean): React.ReactNode {
    const label = (DialogItemsManager.editorWantsLabel(item)) ? this.getEditorLabel(item, isLeftmostRecord) : null;
    return (
      <div key={item.property.name} className="uifw-default-inline-label-and-editor">
        {label}
        {this.getEditor(item)}
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

  public getRow(row: DialogRow, rowIndex: number): React.ReactNode {
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

  public getToolSettingsEntry(row: DialogRow, rowIndex: number): ToolSettingsEntry {
    if (DialogItemsManager.onlyContainButtonGroupEditors(row)) {
      return this.generateEntryWithButtonGroupEditors(row, rowIndex);
    } else {
      return (
        {
          labelNode: this.getLeftLockAndLabel(row.items[0], row.items.length > 1),
          editorNode: this.getDivForRow(row),
        }
      );
    }
  }

  /** ToolSettingsEntries are used by the tool settings bar. */
  public getToolSettingsEntries(): ToolSettingsEntry[] {
    return this._itemsManager.rows.map((row: DialogRow, index: number) => this.getToolSettingsEntry(row, index));
  }
}
