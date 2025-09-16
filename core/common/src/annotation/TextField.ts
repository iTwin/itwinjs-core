/*----------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Id64String } from "@itwin/core-bentley";
import { Format, FormatDefinition, ResolvedFormatProps, UnitConversionProps, UnitConversionSpec, UnitProps } from "@itwin/core-quantity";

/** Enumerates the different kinds of [Property]($ecschema-metadata) values that can be used as the basis for a [[FieldRun]]'s display string.
 * A field's property type is derived from the property's [PrimitiveType]($ecschema-metadata) and other attributes like its [PrimitiveOrEnumPropertyBase.extendedTypeName]($ecschema-metadata).
 * The conversion of the raw property value into a display string can be customized by different [[FieldFormatOptions]] based on its type.
 * The following types are currently recognized:
 *  - "quantity": an often-unitized scalar value like a distance or area, formatted using a quantity [Format]($core-quantity).
 *  - "coordinate": a 2- or 3-dimensional point, with each component formatted as a "quantity".
 *  - "boolean": a true or false value.
 *  - "datetime": an ECMAScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date).
 *  - "int-enum": an integer [EnumerationProperty]($ecschema-metadata) formatted using the enum value's display label.
 *  - "string-enum": a string [EnumerationProperty]($ecschema-metadata) formatted using the enum value's display label.
 *  - "string": a value convertible to a string.
 * @beta
 */
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
  /** If [[propertyName]] (and [[acessors]], if present) resolves to a BIS property of extended type "Json", specifies the path to a field within the JSON object. */
  json?: {
    /** Property names and/or array indices describing the path to the ultimate JSON property. */
    accessors: Array<string | number>;
    /** Optionally specifies the expected type of the JSON property. If unspecified, then numbers are treated as "quantity", booleans as "boolean", and strings as "string". */
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

/** As part of [[CoordinateFieldFormatOptions]], specifies which component(s) to include in the display string.
 * @beta
 */
export type CoordinateComponentSelector = "X" | "Y" | "Z" | "XY" | "XYZ";

/** As part of [[FieldFormatOptions]], specifies how to modify the case of the display string.
 * "as-is" leaves it unmodified. "upper" and "lower" convert it to all upper-case or all lower-case, respectively.
 * @beta
 */
export type FieldCase = "as-is" | "upper" | "lower";

/** As part of a [[FieldFormatOptions]], specifies how to format properties of [[FieldPropertyType]] "boolean".
 * @beta
 */
export interface BooleanFieldFormatOptions {
  /** The display string if the property is `true`.
   * Default: "true" (non-localized).
   */
  trueString?: string;
  /** The display string if the property is `false`.
   * Default: "false" (non-localized).
   */
  falseString?: string;
}

/** As part of a [[FieldFormatOptions]], specifies how to format properties of [[FieldPropertyType]] "coordinate".
 * @beta
 */
export interface CoordinateFieldFormatOptions {
  /** Specifies which component(s) (X, Y, and/or Z) to include in the display string.
   * Default: "XYZ".
   * @note For two-dimensional points, Z is always omitted even if specified here.
   */
  components?: CoordinateComponentSelector;
  /** The string to insert between components.
   * Default: "," (comma).
   */
  componentSeparator?: string;
}

/** As part of a [[FieldFormatOptions]], specifies how to format properties of [[FieldPropertyType]] "quantity".
 * @beta
 */
export interface QuantityFieldFormatOptions {
  /** Optionally records the name of the [KindOfQuantity]($ecschema-metadata) from which the other properties were derived.
   * This property is not used during formatting.
   */
  koqName?: string;
  /** The units in which the field property value is defined. */
  sourceUnit?: UnitProps;
  /** An array of conversion factors necessary to convert from [[sourceUnit]] to the units specified in [[formatProps]]. */
  unitConversions?: UnitConversionSpec[];
  /** JSON representation of the [Format]($core-quantity) used to produce the display string. */
  formatProps?: ResolvedFormatProps;
}

/** As part of a [[FieldFormatOptions]], specifies how to format properties of [[FieldPropertyType]] "datetime".
 * @beta
 */
export interface DateTimeFieldFormatOptions {
  /** The locale with which to localize the display string.
   * Default: "en-US".
   */
  locale?: Intl.UnicodeBCP47LocaleIdentifier;
  /** Describes how to produce the display string. */
  formatOptions?: Intl.DateTimeFormatOptions;
}

/** As part of a [[FieldFormatOptions]], specifies how to format properties of [[FieldPropertyType]] "int-enum" or "string-enum".
 * The value will be mapped to the corresponding display label.
 * If a label cannot be determined, formatting will fail and the field will display as [[FieldRun.invalidFieldIndicator]].
 * @beta
 */
export interface EnumFieldFormatOptions<T extends number| string> {
  /** Maps the possible enumeration values to display strings. */
  labels: Array<{ value: T, label: string }>;
  /** Specifies a default display string to use if the property value does not appear as a key in [[labels]]. */
  fallbackLabel?: string;
}

/** Customizes how to format the raw property value resolved by a [[FieldPropertyPath]] into a [[FieldRun]]'s display string.
 * The exact options used depend upon the [[FieldPropertyType]].
 * @beta
 */
export interface FieldFormatOptions {
  /** A string inserted before the formatted string. This string is not affected by [[case]]. */
  prefix?: string;
  /** A string inserted after the formatted string. This string is not affected by [[case]]. */
  suffix?: string;
  /** Modifies the case of the formatted string. */
  case?: FieldCase;
  /** Formatting options for [[FieldPropertyType]] "boolean". */
  boolean?: BooleanFieldFormatOptions;
  /** Formatting options for [[FieldPropertyType]] "coordinate". */
  coordinate?: CoordinateFieldFormatOptions;
  /** Formatting options for [[FieldPropertyType]] "quantity". */
  quantity?: QuantityFieldFormatOptions;
  /** Formatting options for [[FieldPropertyType]] "datetime". */
  dateTime?: DateTimeFieldFormatOptions;
  /** Formatting options for [[FieldPropertyType]] "int-enum" or "string-enum". */
  enum?: EnumFieldFormatOptions<number> | EnumFieldFormatOptions<string>;
}
