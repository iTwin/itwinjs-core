/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";

/**
 * Manages Type Converters. Type Converters are registered with and obtained from the
 * manager.
 */
export class TypeConverterManager {
  private static converters: { [index: string]: (TypeConverter) } = {};
  private static defaultTypeConverter: TypeConverter;

  public static registerConverter(typename: string, converter: typeof TypeConverter): void {
    if (TypeConverterManager.converters.hasOwnProperty(typename))
      return;

    const instance = new converter();
    TypeConverterManager.converters[typename] = instance;
  }

  public static getConverter(typename: string): TypeConverter {
    if (TypeConverterManager.converters.hasOwnProperty(typename))
      return TypeConverterManager.converters[typename];

    if (!TypeConverterManager.defaultTypeConverter) {
      const { StringTypeConverter } = require("../converters/StringTypeConverter");
      TypeConverterManager.defaultTypeConverter = new StringTypeConverter();
    }
    return TypeConverterManager.defaultTypeConverter;
  }
}
