/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/** Hexadecimal Type Converter.
 */
export class HexadecimalTypeConverter extends TypeConverter {
  public async convertToString(value: any): Promise<string> {
    if (null === value || undefined === value)
      return "";

    const valueStr = value.toString(16);
    return valueStr.toUpperCase();
  }

  public async convertFromString(value: string): Promise<any> {
    if (null === value || undefined === value)
      return undefined;

    if (value[1] === "x")
      return parseInt(value.substr(2), 16);
    else
      return parseInt(value, 16);
  }
}
TypeConverterManager.registerConverter("hex", HexadecimalTypeConverter);
TypeConverterManager.registerConverter("hexadecimal", HexadecimalTypeConverter);
