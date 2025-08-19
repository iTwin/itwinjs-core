/*----------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Id64String } from "@itwin/core-bentley";

/** A chain of property accesses that resolves to a primitive value that forms the basis of the displayed content
 * of a [[FieldRun]].
   * The simplest property paths consist of a [[propertyName]] and nothing else, where `propertyName` identifies
   * a primitive property.
   * If `propertyName` identifies a struct or array property, then additional [[accessors]] are required to identify the specific value.
   * If `propertyName` (including any [[accessors]]) resolves to a JSON property, then additional [[jsonAccessors]] are required to identify a specific value within the JSON.
   * Some examples:
   * ```
   * | Access String | propertyName | accessors | jsonAccessors |
   * | ------------- | ------------ | --------- | ------------- |
   * | name          | "name"       | undefined | undefined     |
   * | spouse.name   | "spouse"     | [name]    | undefined     |
   * | colors[2]     | "colors"     | [2]       | undefined     |
   * | spouse.favoriteRestaurants[1].address | "spouse" | ["favoriteRestaurants", 1, "address"] | undefined |
   * | jsonProperties.contactInfo.email | "jsonProperties" | undefined | ["contactInfo", "email"] |
   * | spouse.jsonProperties.contactInfo.phoneNumbers[0].areaCode | "spouse" | ["jsonProperties"] | ["contactInfo", "phoneNumbers", 0, "areaCode"] |
   * ```
 * @beta
 */
export interface FieldPropertyPath {
  /** The name of the BIS property of the [[FieldPropertyHost]] that serves as the root of the path. */
  propertyName: string;
  /** Property names and/or array indices describing the path from [[propertyName]] to the ultimate BIS property. */
  accessors?: Array<string | number>;
  /** If [[propertyName]] and [[accessors]] (if defined) resolve to a BIS property of extended type `Json`, property names and/or
   * array indices for selecting a primitive value within the JSON.
   */
  jsonAccessors?: Array<string | number>;
}

/** Describes the source of the property value against which a [[FieldPropertyPath]] is evaluated.
 * A field property is always hosted by an [Element]($backend). It may be a property of the element's BIS class itself,
 * or that of one of its [ElementAspect]($backend)s.
 * The [[schemaName]] and [[className]] should always identify the exact class that contains [[FieldPropertyPath.propertyName]] - not a subclass thereof.
 * @beta
 */
export interface FieldPropertyHost {
  /** The Id of the [Element]($backend) that hosts the property. */
  elementId: Id64String;
  /** The name of the schema containing the class identified by [[className]]. */
  schemaName: string;
  /** The name of the exact class (not a subclass) containing the property identified by [[FieldPropertyPath.propertyName]]. */
  className: string;
}

export type FieldPropertyType = "quantity" | "coordinate" | "string" | "boolean" | "datetime" | "enum";

export type CoordinateComponentSelector = "X" | "Y" | "Z" | "XY" | "XYZ";

export type FieldCase = "as-is" | "upper" | "lower" | "first-capital" | "title";

export interface BooleanFieldFormatOptions {
  trueString?: string;
  falseString?: string;
}

export interface CoordinateFieldFormatOptions {
  components?: CoordinateComponentSelector;
  componentSeparator?: string;
}

export interface QuantityFieldFormatOptions {
  // ###TODO source+target units, FormatProps.
}

export interface DateTimeFieldFormatOptions {
  // ###TODO select from a fixed list of possible formats for date and/or time?
  // ###TODO localization of months and days (long and short versions)
}

export interface EnumFieldFormatOptions {
  labels: Array<{ value: number, label: string }>;
}

/** Placeholder type for a description of how to format the raw property value resolved by a [[FieldPropertyPath]] into a [[FieldRun]]'s display string.
 * *** COMING SOON ***
 * @beta
 */
export interface FieldFormatOptions {
  prefix?: string;
  suffix?: string;
  case?: FieldCase;
  boolean?: BooleanFieldFormatOptions;
  coordinate?: CoordinateFieldFormatOptions;
  quantity?: QuantityFieldFormatOptions;
  dateTime?: DateTimeFieldFormatOptions;
  enum?: EnumFieldFormatOptions;
}


