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
  // ###TODO source+target units, FormatProps.
  koqName?: string;
  sourceUnit?: UnitProps;
  targetUnit?: UnitProps;
  unitConversions?: UnitConversionSpec[];
  formatProps?: ResolvedFormatProps;
}

export interface DateTimeFieldFormatOptions {
  // ###TODO this should probably specify a list of "date-time parts" mixed in with other strings like commas and other separators like "of" or whatever.
  // Examples of parts:
  //  - Date: day of week (long or short name, or number), month (long or short name, or number), year (full or only last 2 digits)
  //  - Time: hour (using 12- or 24-hour clock), minute, second, milliseconds, AM/PM
  // Days, months, AM/PM, etc are subject to localization so this options object would need to include any localized strings that might
  // be needed for the parts it specifies in its formatting.
  // People might also want to ask that the date be translated to a specific time zone before formatting is applied.
  // For now we simply spit out the full Date as a string in ISO8601 format.
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

export function fieldFormatOptionsDeepEquals(opts1: FieldFormatOptions, opts2: FieldFormatOptions): boolean {
  // Check basic string properties
  if (opts1.case !== opts2.case ||
      opts1.prefix !== opts2.prefix ||
      opts1.suffix !== opts2.suffix) {
    return false;
  }

  // Check boolean format options
  if (!booleanFormatOptionsEqual(opts1.boolean, opts2.boolean)) {
    return false;
  }

  // Check enum format options
  if (!enumFormatOptionsEqual(opts1.enum, opts2.enum)) {
    return false;
  }

  // Check quantity format options
  if (!quantityFormatOptionsEqual(opts1.quantity, opts2.quantity)) {
    return false;
  }

  // Check coordinate format options
  if (!coordinateFormatOptionsEqual(opts1.coordinate, opts2.coordinate)) {
    return false;
  }

  return true;
}

function booleanFormatOptionsEqual(
  opts1: BooleanFieldFormatOptions | undefined,
  opts2: BooleanFieldFormatOptions | undefined
): boolean {
  if (opts1 === opts2) return true;
  if (!opts1 || !opts2) return false;

  return opts1.trueString === opts2.trueString &&
         opts1.falseString === opts2.falseString;
}

function enumFormatOptionsEqual(
  opts1: EnumFieldFormatOptions<number | string> | undefined,
  opts2: EnumFieldFormatOptions<number | string> | undefined
): boolean {
  if (opts1 === opts2) return true;
  if (!opts1 || !opts2) return false;

  if (opts1.fallbackLabel !== opts2.fallbackLabel) return false;

  // Compare labels arrays
  const labels1 = opts1.labels;
  const labels2 = opts2.labels;

  if (labels1 === labels2) return true;
  if (!labels1 || !labels2) return false;
  if (labels1.length !== labels2.length) return false;

  for (let i = 0; i < labels1.length; i++) {
    if (labels1[i].value !== labels2[i].value ||
        labels1[i].label !== labels2[i].label) {
      return false;
    }
  }

  return true;
}

function quantityFormatOptionsEqual(
  opts1: QuantityFieldFormatOptions | undefined,
  opts2: QuantityFieldFormatOptions | undefined
): boolean {
  if (opts1 === opts2) return true;
  if (!opts1 || !opts2) return false;

  // Compare formatProps using JSON stringify (similar to existing TODO pattern)
  // This could be improved with a proper deep equality check
  if (JSON.stringify(opts1.formatProps) !== JSON.stringify(opts2.formatProps)) {
    return false;
  }

  // Compare unitConversions
  if (JSON.stringify(opts1.unitConversions) !== JSON.stringify(opts2.unitConversions)) {
    return false;
  }

  // Compare sourceUnit
  if (JSON.stringify(opts1.sourceUnit) !== JSON.stringify(opts2.sourceUnit)) {
    return false;
  }

  return true;
}

function coordinateFormatOptionsEqual(
  opts1: CoordinateFieldFormatOptions | undefined,
  opts2: CoordinateFieldFormatOptions | undefined
): boolean {
  if (opts1 === opts2) return true;
  if (!opts1 || !opts2) return false;

  return opts1.components === opts2.components &&
         opts1.componentSeparator === opts2.componentSeparator;
}

