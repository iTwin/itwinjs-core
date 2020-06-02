/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TypeConverters
 */

import { Primitives, PropertyDescription } from "@bentley/ui-abstract";
import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { StandardTypeNames } from "../common/StandardTypeNames";

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
    return TypeConverterManager.getConverter(StandardTypeNames.Hexadecimal).sortCompare(a, b, ignoreCase);
  }
}

TypeConverterManager.registerConverter(StandardTypeNames.Navigation, NavigationPropertyTypeConverter);
