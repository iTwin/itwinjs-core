/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

// import { HorizontalAlignment, VerticalAlignment } from "@bentley/ui-core";
import { PropertyDescription } from "./Description";
import { PrimitiveValue, PropertyValue, PropertyValueFormat } from "./Value";
import { PropertyRecord } from "./Record";

/** Primitive ToolSettings Value. */
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

/**
 * Enumeration for horizontal alignment.
 */
export const enum TsHorizontalAlignment {
  Left = 1,
  Center = 2,
  Right = 3,
  Justify = 4,
}

/**
 * Enumeration for vertical alignment.
 */
export const enum TsVerticalAlignment {
  Top = 1,
  Middle = 2,
  Bottom = 3,
}

/** Interface used to identify the location of the UI control to manipulate a ToolSettings property value. */
export interface EditorPosition {
  rowPriority: number;
  columnPriority: number;
  /** Defaults to left */
  horizontalAlignment?: TsHorizontalAlignment;
  /** Defaults to top */
  verticalAlignment?: TsVerticalAlignment;
  /** Number of columns to occupy. Defaults to 1 */
  columnSpan?: number;
  /** Number of rows to occupy. Defaults to 1 */
  rowSpan?: number;
}

/** Class used to identify a specific ToolSettings property value. */
export class ToolSettingsPropertySyncItem {
  public value: ToolSettingsValue;
  public propertyName: string;

  public constructor(value: ToolSettingsValue, propertyName: string) {
    this.value = value;
    this.propertyName = propertyName;
  }
}

/** Property Record to specify an editor in Tool Settings zone. */
export class ToolSettingsPropertyRecord extends PropertyRecord {
  public editorPosition: EditorPosition;

  public constructor(value: PropertyValue, property: PropertyDescription, editorPosition: EditorPosition) {
    super(value, property);
    this.editorPosition = editorPosition;
  }
}
