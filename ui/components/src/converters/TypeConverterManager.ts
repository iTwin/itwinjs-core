/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";

/**
 * Manages Type Converters. Type Converters are registered with and obtained from the manager.
 */
export class TypeConverterManager {
  private static _converters: { [index: string]: (TypeConverter) } = {};
  private static _defaultTypeConverter: TypeConverter;

  public static registerConverter(typename: string, converter: typeof TypeConverter): void {
    if (TypeConverterManager._converters.hasOwnProperty(typename)) {
      const nameOfConverter = TypeConverterManager._converters[typename].constructor.name;
      throw Error("TypeConverterManager.registerConverter error: type '" + typename + "' already registered to '" + nameOfConverter + "'");
    }

    const instance = new converter();
    TypeConverterManager._converters[typename] = instance;
  }

  public static getConverter(typename: string): TypeConverter {
    if (TypeConverterManager._converters.hasOwnProperty(typename))
      return TypeConverterManager._converters[typename];

    if (!TypeConverterManager._defaultTypeConverter) {
      const { StringTypeConverter } = require("../converters/StringTypeConverter");
      TypeConverterManager._defaultTypeConverter = new StringTypeConverter();
    }
    return TypeConverterManager._defaultTypeConverter;
  }
}
