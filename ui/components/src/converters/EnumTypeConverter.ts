/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { PropertyDescription, EnumerationChoice } from "../properties";
import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/**
 * Enum Type Converter.
 */
export class EnumTypeConverter extends TypeConverter {
  public async convertPropertyToString(propertyDescription: PropertyDescription, value: any): Promise<string> {
    if (propertyDescription.enum) {
      const pos = this.getPosition(propertyDescription.enum.choices, value);
      if (-1 !== pos)
        return propertyDescription.enum.choices[pos].label;
    }

    return super.convertToString(value);
  }

  private getPosition(choices: EnumerationChoice[], value: any): number {
    for (let i = 0; i < choices.length; ++i) {
      if (choices[i].value === value)
        return i;
    }
    return -1;
  }
}
TypeConverterManager.registerConverter("enum", EnumTypeConverter);
