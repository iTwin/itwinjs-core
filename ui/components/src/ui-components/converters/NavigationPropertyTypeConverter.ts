/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { PropertyDescription } from "../properties/Description";
import { TypeConverter, StandardTypeConverterTypeNames } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import * as Primitives from "./valuetypes/PrimitiveTypes";

/**
 * Navigation property type converter
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
