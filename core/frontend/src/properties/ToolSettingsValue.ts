/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

// import { HorizontalAlignment, VerticalAlignment } from "@bentley/ui-core";
import { PropertyDescription } from "./Description";
import { PrimitiveValue, PropertyValue, PropertyValueFormat } from "./Value";
import { PropertyRecord } from "./Record";

/** Primitive ToolSettings Value.
 * @beta
 */
export class ToolSettingsValue implements PrimitiveValue {
  public readonly valueFormat = PropertyValueFormat.Primitive;
  public value?: number | string | boolean | Date;
  public displayValue?: string;

  public constructor(value?: number | string | boolean | Date, displayValue?: string) {
    this.value = value;
    this.displayValue = displayValue;
  }

  public get isNullValue(): boolean {
    return undefined === this.value;
  }

  public get hasDisplayValue(): boolean {
    return undefined !== this.displayValue;
  }

  public update(newValue: ToolSettingsValue): boolean {
    if (newValue.valueFormat !== this.valueFormat)
      throw new Error("ToolSettingsValue.update requires both values to be of the same format");

    if (this.value === newValue.value && this.displayValue === newValue.displayValue)
      return false;

    this.value = newValue.value;
    this.displayValue = newValue.displayValue;
    return true;
  }

  public clone(): ToolSettingsValue {
    return new ToolSettingsValue(this.value, this.displayValue);
  }
}

/** Interface used to identify the location of the UI control to manipulate a ToolSettings property value.
 * @beta
 */
export interface EditorPosition {
  /** Determine the order the row is shown in UI */
  rowPriority: number;
  /** Determines the column position for the type editor */
  columnIndex: number;
  /** Number of columns to occupy. Defaults to 1 */
  columnSpan?: number;
}

/** Class used to identify a specific ToolSettings property value.
 * @beta
 */
export class ToolSettingsPropertySyncItem {
  public value: ToolSettingsValue;
  public propertyName: string;
  /** used to pass enable state to Ui from Tool so property record can be updated */
  public isDisabled?: boolean;

  public constructor(value: ToolSettingsValue, propertyName: string, isDisabled?: boolean) {
    this.value = value;
    this.propertyName = propertyName;
    this.isDisabled = isDisabled;
  }
}

/** Property Record to specify an editor in Tool Settings zone.
 * @beta
 */
export class ToolSettingsPropertyRecord extends PropertyRecord {
  public editorPosition: EditorPosition;

  public constructor(value: PropertyValue, property: PropertyDescription, editorPosition: EditorPosition, isReadonly = false) {
    super(value, property);
    this.editorPosition = editorPosition;
    this.isReadonly = isReadonly;
  }

  public static clone(record: ToolSettingsPropertyRecord, newValue?: ToolSettingsValue): ToolSettingsPropertyRecord {
    const value = Object.assign({}, newValue ? newValue : record.value);
    const newRecord = new ToolSettingsPropertyRecord(value, record.property, record.editorPosition, record.isReadonly);
    newRecord.isDisabled = record.isDisabled;
    return newRecord;
  }
}
