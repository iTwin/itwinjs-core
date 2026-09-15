/*----------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Id64String } from "@itwin/core-bentley";

/** Enumerates the different kinds of [Property]($ecschema-metadata) values that can be used as the basis for a [[FieldRun]]'s display string.
 * A field's property type is derived from the property's [PrimitiveType]($ecschema-metadata) and other attributes like its [PrimitiveOrEnumPropertyBase.extendedTypeName]($ecschema-metadata).
 * The conversion of the raw property value into a display string can be customized by different [[FieldFormatOptions]] based on its type.
 * The following types are currently recognized:
 *  - "quantity": an often-unitized scalar value like a distance or area, formatted using a quantity [Format]($core-quantity).
 *  - "coordinate": a 2- or 3-dimensional point, with each component formatted as a "quantity".
 *  - "boolean": a true or false value; currently converted via `toString()` (localized formatting not yet implemented).
 *  - "datetime": an ECMAScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date).
 *  - "int-enum": an integer [EnumerationProperty]($ecschema-metadata); currently converted via `toString()` (display-label lookup not yet implemented).
 *  - "string-enum": a string [EnumerationProperty]($ecschema-metadata); currently converted via `toString()` (display-label lookup not yet implemented).
 *  - "string": a value convertible to a string.
 * @note `"quantity"` and `"coordinate"` values format through the quantity pipeline only when a
 * [FieldFormattingSpecProvider]($backend) is registered for the iModel and has already built a
 * [Format]($core-quantity) for the field. Otherwise they render as `value.toString()` — a bare
 * number, or `(x, y[, z])` for a coordinate.
 * @beta
 */
export type FieldPropertyType = "quantity" | "coordinate" | "string" | "boolean" | "datetime" | "int-enum" | "string-enum";

/** A chain of property accesses that resolves to a primitive value that forms the basis of the displayed content
 * of a [[FieldRun]].
 * The simplest property paths consist of a [[propertyName]] and nothing else, where `propertyName` identifies
 * a primitive property.
 * If `propertyName` identifies a struct or array property, then additional [[accessors]] are required to identify the specific value.
 * Some examples:
 * ```
 * | Access String | propertyName | accessors |
 * | ------------- | ------------ | --------- |
 * | name          | "name"       | undefined |
 * | spouse.name   | "spouse"     | [name]    |
 * | colors[2]     | "colors"     | [2]       |
 * | spouse.favoriteRestaurants[1].address | "spouse" | ["favoriteRestaurants", 1, "address"] |
 * ```
 * @beta
 */
export interface FieldPropertyPath {
  /** The name of the BIS property of the [[FieldPropertyHost]] that serves as the root of the path. */
  propertyName: string;
  /** Property names and/or array indices describing the path from [[propertyName]] to the ultimate BIS property. */
  accessors?: Array<string | number>;
}

/** Describes the source of the property value against which a [[FieldPropertyPath]] is evaluated.
 * A field property is always hosted by an [Element]($backend). It may refer to a property belonging to any of the following:
 * - The element's BIS class itself;
 * - One of the element's [ElementAspect]($backend)s;
 * - Or an [EC view]($docs/learning/ECSqlReference/Views.md) with the same ECInstanceId as the element.
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

/** As part of a [[FieldFormatOptions]], specifies how to modify the case of the display string.
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

/** As part of a [[FieldFormatOptions]], specifies how to format [[FieldPropertyType]]
 * `"quantity"` or `"coordinate"` values.
 *
 * [[kindOfQuantity]] and [[persistenceUnit]] are independent overrides: setting one falls
 * through to the property for the other. A field that resolves no format renders its raw value.
 *
 * These property names are also the persisted form — a [[FieldRun]] serializes them verbatim
 * into its element's `TextAnnotationData` — so applications can query for annotations carrying
 * quantity overrides by the literal strings `"kindOfQuantity"` and `"persistenceUnit"`.
 * @see [Quantity formatting for text annotation fields]($docs/learning/backend/TextAnnotationFields.md)
 * for the full resolution order.
 * @beta
 */
export interface QuantityFieldFormatOptions {
  /** Full name of a [Unit]($ecschema-metadata) (e.g. `"Units.M"`) a
   * magnitude is expressed in, overriding the property's persistence unit.
   *
   * Because this states what the value *means* rather than how it looks, it does not fall back
   * to the property's own unit when the two disagree — the field renders raw instead.
   */
  persistenceUnit?: string;
  /** Full name of a [KindOfQuantity]($ecschema-metadata) (e.g. `"AecUnits.LENGTH"`) to format
   * through, overriding the property's own.
   */
  kindOfQuantity?: string;
  /** Identifier of a FormatSet whose formats take precedence for this field, letting one iModel
   * mix presentations such as metric and imperial callouts.
   *
   * Application-chosen, and matched against the ids supplied to
   * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend); iTwin.js does not
   * resolve it against anything persisted in the iModel. A field naming an id that was never
   * supplied falls through to the iModel's schema presentation format.
   */
  formatSet?: string;
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
  /** Formatting options for [[FieldPropertyType]] `"quantity"` and `"coordinate"`. */
  quantity?: QuantityFieldFormatOptions;
}
