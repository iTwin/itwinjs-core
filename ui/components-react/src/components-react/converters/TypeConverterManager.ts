/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TypeConverters
 */

import type { TypeConverter } from "./TypeConverter";

/**
 * Manages Type Converters. Type Converters are registered with and obtained from the manager.
 * @public
 */
export class TypeConverterManager {
  private static _converters: { [index: string]: (TypeConverter) } = {};
  private static _defaultTypeConverter: TypeConverter;

  private static getFullConverterName(typename: string, converterName?: string): string {
    let fullConverterName = typename;
    if (converterName)
      fullConverterName += `:${converterName}`;
    return fullConverterName;
  }

  public static registerConverter(typename: string, converter: new () => TypeConverter, converterName?: string): void {
    const fullConverterName = TypeConverterManager.getFullConverterName(typename, converterName);

    if (TypeConverterManager._converters.hasOwnProperty(fullConverterName)) {
      const nameOfConverter = TypeConverterManager._converters[fullConverterName].constructor.name;
      throw Error(`TypeConverterManager.registerConverter error: type '${typename}' already registered to '${nameOfConverter}'`);
    }

    const instance = new converter();
    TypeConverterManager._converters[fullConverterName] = instance;
  }

  public static unregisterConverter(typename: string, converterName?: string): void {
    const fullConverterName = TypeConverterManager.getFullConverterName(typename, converterName);

    // istanbul ignore else
    if (TypeConverterManager._converters.hasOwnProperty(fullConverterName)) {
      delete TypeConverterManager._converters[fullConverterName];
    }
  }

  public static getConverter(typename: string, converterName?: string): TypeConverter {
    const fullConverterName = TypeConverterManager.getFullConverterName(typename, converterName);

    if (TypeConverterManager._converters.hasOwnProperty(fullConverterName))
      return TypeConverterManager._converters[fullConverterName];

    if (!TypeConverterManager._defaultTypeConverter) {
      const { StringTypeConverter } = require("../converters/StringTypeConverter"); // eslint-disable-line @typescript-eslint/no-var-requires
      TypeConverterManager._defaultTypeConverter = new StringTypeConverter();
    }
    return TypeConverterManager._defaultTypeConverter;
  }
}
