/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { PropertyDescription } from "./Description";
import { PropertyValue, PropertyValueFormat } from "./Value";
import { TypeConverterManager } from "../converters";

/**
 * PropertyRecord contains instance information about a Property, including a
 * value that can be edited using a PropertyEditor and converted using a TypeConverter.
 */
export class PropertyRecord {
  public readonly value: PropertyValue;
  public readonly property: PropertyDescription;
  public description?: string;
  public isReadonly?: boolean;
  public isMerged?: boolean;
  // unit?: string; // [grigas] should this be in the PropertyValue?
  // KOQ?: ECKindOfQuantityInfo; // [grigas] should this be in the PropertyValue or PropertyDescription?

  public constructor(value: PropertyValue, property: PropertyDescription) {
    this.value = value;
    this.property = property;
  }

  /** Gets the display value for this PropertyRecord */
  public async getDisplayValue(): Promise<string> {
    if (this.value.valueFormat === PropertyValueFormat.Primitive)
      return this.value.displayValue;
    return TypeConverterManager.getConverter(this.property.typename).convertPropertyToString(this.property, this.value);
  }

  /** Creates a copy of this PropertyRecord with a new value */
  public copyWithNewValue(newValue: PropertyValue): PropertyRecord {
    return new PropertyRecord(newValue, this.property);
  }
}
