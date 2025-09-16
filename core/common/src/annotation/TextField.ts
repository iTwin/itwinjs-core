/*----------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Id64String } from "@itwin/core-bentley";
import { Format, FormatDefinition, ResolvedFormatProps, UnitConversionProps, UnitConversionSpec, UnitProps } from "@itwin/core-quantity";

export type FieldPropertyType = "quantity" | "coordinate" | "string" | "boolean" | "datetime" | "int-enum" | "string-enum";

/** A chain of property accesses that resolves to a primitive value that forms the basis of the displayed content
 * of a [[FieldRun]].
   * The simplest property paths consist of a [[propertyName]] and nothing else, where `propertyName` identifies
   * a primitive property.
   * If `propertyName` identifies a struct or array property, then additional [[accessors]] are required to identify the specific value.
   * If `propertyName` (including any [[accessors]]) resolves to a JSON property, then additional [[json]] accessors are required to identify a specific value within the JSON.
   * Some examples:
   * ```
   * | Access String | propertyName | accessors | json.accessors |
   * | ------------- | ------------ | --------- | -------------- |
   * | name          | "name"       | undefined | undefined      |
   * | spouse.name   | "spouse"     | [name]    | undefined      |
   * | colors[2]     | "colors"     | [2]       | undefined      |
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
  json?: {
    accessors: Array<string | number>;
    type?: FieldPropertyType | string;
  };
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

export type CoordinateComponentSelector = "X" | "Y" | "Z" | "XY" | "XYZ";

export type FieldCase = "as-is" | "upper" | "lower";
export interface BooleanFieldFormatOptions {
  trueString?: string;
  falseString?: string;
}

export interface CoordinateFieldFormatOptions {
  components?: CoordinateComponentSelector;
  componentSeparator?: string;
}

export interface QuantityFieldFormatOptions {
  koqName?: string;
  sourceUnit?: UnitProps;
  targetUnit?: UnitProps;
  unitConversions?: UnitConversionSpec[];
  formatProps?: ResolvedFormatProps;
}

export interface DateTimeFieldFormatOptions {
  locale?: Intl.UnicodeBCP47LocaleIdentifier;
  formatOptions?: Intl.DateTimeFormatOptions;
}

export interface EnumFieldFormatOptions<T extends number| string> {
  labels: Array<{ value: T, label: string }>;
  fallbackLabel?: string;
}

/** Placeholder type for a description of how to format the raw property value resolved by a [[FieldPropertyPath]] into a [[FieldRun]]'s display string.
 * The exact options used depend upon the [[FieldPropertyType]].
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
  enum?: EnumFieldFormatOptions<number> | EnumFieldFormatOptions<string>;
}
