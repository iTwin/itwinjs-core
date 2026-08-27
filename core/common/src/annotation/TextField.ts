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
 * @note `"quantity"` and `"coordinate"` fields format through the iTwin.js quantity pipeline
 * only when a [FieldFormattingSpecProvider]($backend) has been registered for the iModel via
 * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend) and pre-warmed with
 * the field's requirements. Otherwise — and for a requirement that was never warmed — they
 * fall back to the raw string representation.
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
 * [[kindOfQuantity]] and [[persistenceUnit]] are **independent** overrides: setting one
 * falls through to the property side for the other. At runtime the formatter tries the
 * (KindOfQuantity name, persistence unit name) pairs in this order:
 *
 *  1. **Effective override pair.** `kindOfQuantity ?? propertyKindOfQuantity` paired with
 *     `persistenceUnit ?? propertyPersistenceUnit`, looked up via the active
 *     [FormatsProvider]($core-quantity).
 *  2. **Property-side pair.** `(propertyKindOfQuantity, propertyPersistenceUnit)` — skipped
 *     when identical to the effective pair, and skipped entirely when [[persistenceUnit]] names
 *     a **different** unit than the property's own (see below).
 *
 * The property-side fallback is a *presentation* fallback only. [[kindOfQuantity]] chooses how a
 * magnitude is displayed, so falling back to the property's KoQ yields a different-looking but
 * still correct number. [[persistenceUnit]], by contrast, is a statement about what the stored
 * magnitude *means*: a field declaring `persistenceUnit: "Units.FT"` asserts that the `2.5` on
 * the property is 2.5 feet. Formatting that 2.5 through the property's meter-based pair would
 * render it as 2.5 m — a silently wrong value, off by the conversion factor. So when
 * [[persistenceUnit]] disagrees with the property's persistence unit, there is no fallback:
 * either the requested pair is pre-warmed, or the field renders its raw value and the shortfall
 * is reported (on the synchronous path, via
 * [FieldFormattingSpecProvider.misses]($backend)). When [[persistenceUnit]] agrees with the
 * property's unit — or is omitted — the property-side pair remains a safe fallback.
 *
 * The first pair with a pre-warmed [FormatterSpec]($core-quantity) wins; if neither resolves,
 * the field falls back to `toString()` for `"quantity"` or a `(x, y[, z])` tuple for
 * `"coordinate"`. Core does not synthesize a coordinate format — coordinate presentation is
 * [FormatsProvider]($core-quantity) territory.
 *
 * **Values read out of a JSON-in-string property are a special case.** Such a leaf has no EC
 * property behind it, so there is no property-side pair to fall through to and only
 * [[kindOfQuantity]] and [[persistenceUnit]] can form a candidate. Declaring just one — or
 * neither — is not an error: the field simply renders its raw value, exactly as it would have
 * without a quantity type at all.
 *
 * These property names are also the **persisted** form: a [[FieldRun]] serializes them verbatim
 * into its element's `TextAnnotationData`. Applications may therefore rely on the literal strings
 * `"kindOfQuantity"` and `"persistenceUnit"` when querying for annotations carrying quantity
 * overrides — for example to decide what to pre-warm. See the "Deciding what to warm" section of
 * the 5.4 change history.
 * @beta
 */
export interface QuantityFieldFormatOptions {
  /** Full name of a [Unit]($ecschema-metadata) (e.g. `"Units.M"`) used as the persistence unit
   * when constructing a [FormatterSpec]($core-quantity); overrides the property's persistence
   * unit. Coordinate values whose EC property has no [KindOfQuantity]($ecschema-metadata)
   * require this to be set explicitly (e.g. `Units.LENGTH.M` for BIS geometry — see
   * `docs/bis/guide/other-topics/units.md`) for an override to take effect. See the interface
   * JSDoc for the full resolution priority.
   */
  persistenceUnit?: string;
  /** Full name of a [KindOfQuantity]($ecschema-metadata) (e.g. `"AecUnits.LENGTH"`) to look up
   * via the active [FormatsProvider]($core-quantity), overriding the property's own KoQ. See
   * the interface JSDoc for the full resolution priority.
   */
  kindOfQuantity?: string;
  /** Identifier of a FormatSet whose formats take precedence for this field, letting one iModel
   * mix presentations (e.g. metric and imperial callouts).
   *
   * This is an application-chosen identifier, matched against the ids the application supplies
   * alongside each FormatSet to
   * [ElementDrivesTextAnnotation.registerFieldFormattingProvider]($backend). iTwin.js does not
   * interpret it and does not resolve it against anything persisted in the iModel. A FormatSet
   * with no entry for the field's [KindOfQuantity]($ecschema-metadata) — and a field naming an id
   * that was never supplied — falls through to the iModel's schema presentation format rather
   * than to the raw string.
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
  /** Formatting options for [[FieldPropertyType]] `"quantity"` and `"coordinate"`. See
   * [[QuantityFieldFormatOptions]] for the resolution priority.
   */
  quantity?: QuantityFieldFormatOptions;
}
