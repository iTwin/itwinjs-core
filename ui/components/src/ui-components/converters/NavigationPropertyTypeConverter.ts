/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { PropertyDescription, Primitives } from "@bentley/imodeljs-frontend";
import { TypeConverter, StandardTypeConverterTypeNames } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/**
 * Navigation property type converter
 * @public
 */
export class NavigationPropertyTypeConverter extends TypeConverter {
  public convertPropertyToString(propertyDescription: PropertyDescription, value?: Primitives.Hexadecimal) {
    if (value === undefined)
      return "";
    return propertyDescription.displayLabel;
  }

  public sortCompare(a: Primitives.Hexadecimal, b: Primitives.Hexadecimal, ignoreCase?: boolean): number {
    return TypeConverterManager.getConverter(StandardTypeConverterTypeNames.Hexadecimal).sortCompare(a, b, ignoreCase);
  }
}
TypeConverterManager.registerConverter("navigation", NavigationPropertyTypeConverter);
