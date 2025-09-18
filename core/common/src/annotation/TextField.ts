/*----------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Id64String } from "@itwin/core-bentley";
import type { ResolvedFormatProps, UnitConversionSpec, UnitProps } from "@itwin/core-quantity";

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
  /** If [[propertyName]] (and [[accessors]], if present) resolves to a BIS property of extended type "Json", specifies the path to a field within the JSON object. */
  json?: {
    /** Property names and/or array indices describing the path to the ultimate JSON property. */
    accessors: Array<string | number>;
    /** Optionally specifies the expected type of the JSON property. If unspecified, then numbers are treated as "quantity", booleans as "boolean", and strings as "string".
     * @note This is permitted to be any string because we anticipate adding new [[FieldPropertyType]]s in the future. If you specify an unrecognized type, the
     * field will fail to format and will display as [[FieldRun.invalidContentIndicator]].
     */
    type?: FieldPropertyType | string; // eslint-disable-line @typescript-eslint/no-redundant-type-constituents
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

/** As part of [[FieldFormatOptions]], specifies how to modify the case of the display string.
 * "as-is" leaves it unmodified. "upper" and "lower" convert it to all upper-case or all lower-case, respectively.
 * @beta
 */
export type FieldCase = "as-is" | "upper" | "lower";

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
  /** Formatting options for [[FieldPropertyType]] "datetime". */
  dateTime?: DateTimeFieldFormatOptions;
}
