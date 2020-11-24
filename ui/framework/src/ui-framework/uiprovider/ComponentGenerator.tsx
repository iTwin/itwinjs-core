/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiProvider
 */

import "./DefaultDialogGridContainer.scss";
import classnames from "classnames";
import * as React from "react";
import {
  BaseDialogItem, DialogItem, DialogItemValue, DialogPropertySyncItem, DialogRow, PropertyRecord, PropertyValueFormat, SyncPropertiesChangeEventArgs,
  UiLayoutDataProvider,
} from "@bentley/ui-abstract";
import { EditorContainer, PropertyUpdatedArgs } from "@bentley/ui-components";
import { ToolSettingsEntry } from "../widget-panels/ToolSettings";
import { assert, Logger } from "@bentley/bentleyjs-core";

function EditorLabel({ uiDataProvider, item, isLeftmostRecord }: { uiDataProvider: UiLayoutDataProvider, item: DialogItem, isLeftmostRecord?: boolean }) {
  const [isDisabled, setIsDisabled] = React.useState(!!item.isDisabled);
  const displayLabel = React.useMemo(() => {
    return item.property.displayLabel ? item.property.displayLabel : /* istanbul ignore next */ item.property.name;
  }, [item]);
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
    uiDataProvider.onSyncPropertiesChangeEvent.addListener(handleSync);
    return () => {
      uiDataProvider.onSyncPropertiesChangeEvent.removeListener(handleSync);
    };
  }, [uiDataProvider, item]);

  // istanbul ignore next
  const className = classnames(
    "uifw-default-label",
    isDisabled && "uifw-label-disabled",
    !!isLeftmostRecord && "uifw-default-narrow-only-display",
    !isLeftmostRecord && "uifw-default-inline-label",
  );
  return <label className={className} htmlFor={propertyId}>{displayLabel}:</label>;
}

function PropertyEditor({ uiDataProvider, record, isLock, setFocus }: { uiDataProvider: UiLayoutDataProvider, record: PropertyRecord, isLock?: boolean, setFocus?: boolean }) {
  const initialRecord = React.useRef(record);
  const isMounted = React.useRef(false);
  const [propertyRecord, setPropertyRecord] = React.useState(record);

  React.useEffect(() => {
    if (record !== initialRecord.current) {
      initialRecord.current = record;
      setPropertyRecord(record);
    }
  }, [record]);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // monitor tool for sync UI events
  React.useEffect(() => {
    const handleSync = (args: SyncPropertiesChangeEventArgs) => {
      const mySyncItem = args.properties.find((syncItem: DialogPropertySyncItem) => syncItem.propertyName === record.property.name);
      // istanbul ignore else
      if (mySyncItem) {
        const newPropertyValue = propertyRecord.copyWithNewValue({
          value: mySyncItem.value.value,
          valueFormat: PropertyValueFormat.Primitive,
          displayValue: mySyncItem.value.displayValue,
        }, mySyncItem.property);

        if (mySyncItem.property) {
          // istanbul ignore else
          if (mySyncItem.property.name === mySyncItem.propertyName) {
            newPropertyValue.isDisabled = mySyncItem.isDisabled;
            setPropertyRecord(newPropertyValue);
          } else {
            Logger.logError("PropertyEditor", `Error trying to replace propertyName=${mySyncItem.propertyName} with property named ${mySyncItem.property.name}`);
          }
        } else {
          newPropertyValue.isDisabled = mySyncItem.isDisabled;
          setPropertyRecord(newPropertyValue);
        }
      }
    };
    uiDataProvider.onSyncPropertiesChangeEvent.addListener(handleSync);
    return () => {
      uiDataProvider.onSyncPropertiesChangeEvent.removeListener(handleSync);
    };
  }, [uiDataProvider, propertyRecord, record.property, record.property.name]);

  const className = React.useMemo(() => isLock ? "uifw-default-property-lock" : "uifw-default-editor", [isLock]);
  // istanbul ignore next
  const handleCommit = React.useCallback((commit: PropertyUpdatedArgs) => {
    // UiLayoutDataProvider supports only primitive property types
    // istanbul ignore next
    assert(commit.newValue.valueFormat === PropertyValueFormat.Primitive && commit.propertyRecord.value.valueFormat === PropertyValueFormat.Primitive);
    const newPropertyValue = propertyRecord.copyWithNewValue(commit.newValue);
    const syncItem: DialogPropertySyncItem = { value: commit.newValue as DialogItemValue, propertyName: record.property.name, isDisabled: newPropertyValue.isDisabled };
    uiDataProvider.applyUiPropertyChange(syncItem);
    // The above call could trigger a complete refresh of the UI, so ensure the component
    // is still mounted before calling set state.
    if (isMounted.current)
      setPropertyRecord(newPropertyValue);
  }, [propertyRecord, uiDataProvider, record.property.name]);
  // istanbul ignore next
  const handleCancel = React.useCallback(() => {
  }, []);

  return (
    <div key={record.property.name} className={className} >
      <EditorContainer key={record.property.name} propertyRecord={propertyRecord} setFocus={setFocus} onCommit={handleCommit} onCancel={handleCancel} />
    </div>);
}

/** Utility methods to generate react ui from DialogRow specs
 * @internal
 */
export class ComponentGenerator {
  constructor(private _uiDataProvider: UiLayoutDataProvider) {
  }

  public get uiDataProvider() {
    return this._uiDataProvider;
  }

  private getEditor(item: BaseDialogItem, isLock = false, setFocus = false): React.ReactNode {
    const record = UiLayoutDataProvider.getPropertyRecord(item);
    return <PropertyEditor key={item.property.name} uiDataProvider={this.uiDataProvider} record={record} isLock={isLock} setFocus={setFocus} />;
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
    return <EditorLabel uiDataProvider={this.uiDataProvider} item={item} isLeftmostRecord={isLeftmostRecord} />;
  }

  private getLeftLockAndLabel(rowItem: DialogItem, multiplePropertiesOnRow: boolean): React.ReactNode {
    const record = UiLayoutDataProvider.getPropertyRecord(rowItem);
    // istanbul ignore next
    const lockEditor = (UiLayoutDataProvider.hasAssociatedLockProperty(rowItem)) ? this.getEditor(rowItem.lockProperty!, true) : null;
    const label = (UiLayoutDataProvider.editorWantsLabel(rowItem)) ? this.getEditorLabel(rowItem) : null;
    const classNames = multiplePropertiesOnRow ? "uifw-default-lock-and-label uifw-default-wide-only-display" : "uifw-default-lock-and-label";
    return (
      <div key={`lock-${record.property.name}`} className={classNames}>
        {lockEditor}
        {label}
      </div>
    );
  }

  private getInlineLabelAndEditor(item: DialogItem, isLeftmostRecord: boolean): React.ReactNode {
    const label = (UiLayoutDataProvider.editorWantsLabel(item)) ? this.getEditorLabel(item, isLeftmostRecord) : null;
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
    if (UiLayoutDataProvider.onlyContainButtonGroupEditors(row)) {
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
    if (UiLayoutDataProvider.onlyContainButtonGroupEditors(row)) {
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
    return this.uiDataProvider.rows.map((row: DialogRow, index: number) => this.getToolSettingsEntry(row, index));
  }
}
