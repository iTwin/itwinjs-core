/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TypeConverters
 */

import { TypeConverter } from "./TypeConverter";
import { StringTypeConverter } from "../converters/StringTypeConverter";
import { StandardTypeNames } from "@itwin/appui-abstract";

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
    if (instance.constructor.name === "StringTypeConverter" && !TypeConverterManager._defaultTypeConverter) {
      TypeConverterManager._defaultTypeConverter = instance;
    }
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

    return TypeConverterManager._defaultTypeConverter;
  }
}

// register string type converters here to avoid circular dependency in the StringTypeConverter module
TypeConverterManager.registerConverter(StandardTypeNames.Text, StringTypeConverter);
TypeConverterManager.registerConverter(StandardTypeNames.String, StringTypeConverter);
TypeConverterManager.registerConverter(StandardTypeNames.URL, StringTypeConverter);
