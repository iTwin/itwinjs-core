/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** How a field behaves when the two sides of a merge disagree about it.
 *
 * - `identity` - the field says what the construct *is*, so two different values describe two
 *   different things and no value can be picked without losing one of them. Reported as an error,
 *   and for a property it is what triggers renaming.
 * - `constrained` - the field narrows or qualifies the construct. Both values are meaningful and
 *   picking one is a real decision, so the target's is kept and the disagreement is a warning.
 * - `descriptive` - annotation. The target's value is kept and the disagreement is an info.
 * - `structural` - a collection or nested object the merge walks rather than compares as a leaf.
 *
 * @alpha
 */
export type MergeFieldClass = "identity" | "constrained" | "descriptive" | "structural";

/** The classification of every field the ECJSON writer emits.
 *
 * This is the whole merge policy in one table. The alternative - a check per construct - is what
 * produced roughly fifteen scattered hard-fail sites in ECObjects-native and twenty conflict codes
 * in `ecschema-editing`, several of which are declared and never raised. A field the writer emits
 * without a row here merges as `descriptive` and is reported, and a drift test asserts the table
 * covers a fully populated document.
 *
 * Keyed by field name rather than by full path: no name in the ECJSON vocabulary means something
 * of a different class in two places, and the names that do repeat (`label`, `description`,
 * `priority`) mean the same thing everywhere they appear.
 * @internal
 */
export const mergeFieldClasses: ReadonlyMap<string, MergeFieldClass> = new Map<string, MergeFieldClass>([
  // --- Schema ---
  ["$schema", "descriptive"],
  ["name", "identity"],
  ["version", "identity"],   // handled ahead of the leaf walk: the higher version wins
  ["alias", "identity"],
  ["label", "descriptive"],
  ["description", "descriptive"],
  ["references", "structural"],
  ["items", "structural"],
  ["customAttributes", "structural"],

  // --- Any schema item ---
  ["schemaItemType", "identity"],

  // --- Classes ---
  ["modifier", "constrained"],
  ["baseClass", "structural"],   // narrowing resolves; disjoint bases overflow into `mixins`
  ["mixins", "structural"],
  ["properties", "structural"],
  ["appliesTo", "identity"],     // Mixin.appliesTo and CustomAttributeClass.appliesTo alike

  // --- Properties ---
  ["type", "identity"],          // property kind, enumeration backing type, format type
  ["typeName", "identity"],
  ["relationshipName", "identity"],
  ["direction", "identity"],
  ["kindOfQuantity", "constrained"],
  ["category", "descriptive"],
  ["priority", "descriptive"],
  ["isReadOnly", "constrained"],
  ["extendedTypeName", "constrained"],
  ["minValue", "constrained"],
  ["maxValue", "constrained"],
  ["minLength", "constrained"],
  ["maxLength", "constrained"],
  ["minOccurs", "constrained"],
  ["maxOccurs", "constrained"],
  ["inherited", "descriptive"],

  // --- Relationship class and its constraints ---
  ["strength", "identity"],
  ["strengthDirection", "identity"],
  ["source", "structural"],
  ["target", "structural"],
  ["multiplicity", "constrained"],
  ["roleLabel", "descriptive"],
  ["polymorphic", "constrained"],
  ["abstractConstraint", "constrained"],
  ["constraintClasses", "structural"],

  // --- Enumeration ---
  ["isStrict", "constrained"],
  ["enumerators", "structural"],
  ["value", "identity"],         // an enumerator's value is what the enumerator means

  // --- KindOfQuantity ---
  ["persistenceUnit", "identity"],
  ["relativeError", "constrained"],
  // The ECJSON name; the model calls the same thing `presentationFormats`. This table is keyed on
  // what the writer emits.
  ["presentationUnits", "structural"],

  // --- Units, constants, phenomena ---
  ["definition", "identity"],
  ["phenomenon", "identity"],
  ["unitSystem", "identity"],
  ["invertsUnit", "identity"],
  ["numerator", "identity"],
  ["denominator", "identity"],
  ["offset", "identity"],

  // --- Format ---
  // The composite spec is compared whole: a merge of two composites is a unit sequence neither
  // side authored, which is worse than keeping one. ECObjects-native fails outright here.
  ["composite", "identity"],
  ["precision", "constrained"],
  ["roundFactor", "constrained"],
  ["minWidth", "constrained"],
  ["showSignOption", "constrained"],
  ["formatTraits", "constrained"],
  ["decimalSeparator", "descriptive"],
  ["thousandSeparator", "descriptive"],
  ["uomSeparator", "descriptive"],
  ["scientificType", "identity"],
  ["stationOffsetSize", "constrained"],
  ["stationSeparator", "descriptive"],
]);

/** The class of `field`, or `undefined` when the table has no row for it.
 * @internal
 */
export function mergeFieldClassOf(field: string): MergeFieldClass | undefined {
  return mergeFieldClasses.get(field);
}
