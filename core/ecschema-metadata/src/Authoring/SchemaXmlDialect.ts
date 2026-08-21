/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ECSpec } from "./SchemaDocumentIO";

/** How one ECXML spec version differs from the others, as a flat set of named switches.
 *
 * The four ECXML versions share most of their vocabulary; what changes is a short list of specific
 * decisions. Collecting them here means the reader and writer are written once against the dialect
 * rather than once per version, and that adding a version is a table entry instead of a new walk.
 * It is also the answer to the shape native ended up with, where the same decisions are ~32
 * conditionals spread through a shared writer and are correspondingly hard to follow.
 *
 * The 3.x versions are covered by this table alone. **ECXML 2.0 is not**: its element vocabulary
 * genuinely differs (one `ECClass` element with type flags rather than three typed elements) and it
 * expresses enumerations, kinds of quantity, and property categories as custom attributes, so it
 * needs its own reader and writer. `dialectV20` still exists, because the pieces 2.0 *does* share
 * are worth sharing, but the switches marked below as 2.0-only are what its dedicated
 * implementation acts on.
 * @internal
 */
export interface ECXmlDialect {
  /** The spec version this describes. */
  readonly spec: ECSpec;
  /** Major/minor as they appear in the namespace URI. */
  readonly major: number;
  readonly minor: number;
  /** The full `xmlns` value a document of this version declares. */
  readonly namespace: string;

  /** Whether a schema version string must carry all three components. 3.2 requires `RR.WW.mm`;
   * earlier versions write `RR.mm`, which reads as read/0/minor. */
  readonly requiresThreeComponentVersion: boolean;
  /** How many components a version string is written with. */
  readonly versionComponents: 2 | 3;

  /** Attribute naming the schema's own alias on `ECSchema`. */
  readonly schemaAliasAttribute: "alias" | "nameSpacePrefix";
  /** Attribute naming a reference's alias on `ECSchemaReference`. */
  readonly referenceAliasAttribute: "alias" | "prefix";

  /** Whether classes are three typed elements (`ECEntityClass` / `ECStructClass` /
   * `ECCustomAttributeClass`) or one `ECClass` carrying boolean type flags. 2.0 only. */
  readonly classElements: "typed" | "flagged";
  /** Whether a struct array is its own element or an `ECArrayProperty` with `isStruct`. 2.0 only. */
  readonly structArrayElement: boolean;
  /** Whether `ECNavigationProperty` exists. 2.0 writes navigation properties as plain properties,
   * losing the relationship and direction. */
  readonly navigationProperties: boolean;
  /** Casing of the primitive range attributes: 2.0 wrote `MinimumValue` / `MaximumValue`. */
  readonly rangeAttributes: "camelCase" | "PascalCase";

  /** Relationship endpoint bounds: the attribute name and the spelling of an unbounded upper limit.
   * 2.0 and 3.0 write `cardinality="(0,N)"`; 3.1 and later write `multiplicity="(0..*)"`. */
  readonly constraintBoundsAttribute: "multiplicity" | "cardinality";
  /** Whether the strict `(lo..hi)` grammar applies. Before 3.2 the lenient legacy parser is used,
   * which tolerates `(0,N)`, `(3,N)`, and other malformed spellings by reading them as unbounded. */
  readonly strictMultiplicityGrammar: boolean;
  /** Whether a relationship constraint may carry `abstractConstraint`. 3.1 and later. */
  readonly abstractConstraint: boolean;

  /** Whether `ECEnumeration` is a first-class element (3.0+) rather than a `StandardValues` custom
   * attribute on a property. */
  readonly enumerationItems: boolean;
  /** Whether an `ECEnumerator` carries an explicit `name`. Before 3.2 it does not and one is
   * synthesized on read - see `synthesizeEnumeratorName`. */
  readonly enumeratorNames: boolean;
  /** Attribute naming an enumeration's strictness; renamed in 3.2. */
  readonly enumerationStrictAttribute: "isStrict" | "strict";

  /** Whether `KindOfQuantity` is a first-class element (3.0+) rather than the `UnitSpecification`
   * family of custom attributes. */
  readonly kindOfQuantityItems: boolean;
  /** Whether `PropertyCategory` is a first-class element, and properties carry `category` and
   * `priority` attributes (3.1+). */
  readonly propertyCategoryItems: boolean;
  /** Whether the unit and format item kinds (`Unit`, `InvertedUnit`, `Constant`, `Phenomenon`,
   * `UnitSystem`, `Format`) are serialized at all. 3.2 only; before that a KindOfQuantity refers to
   * the legacy `Units` and `Formats` schemas through FUS descriptor strings. */
  readonly unitAndFormatItems: boolean;
}

const ECXML_NAMESPACE_BASE = "http://www.bentley.com/schemas/Bentley.ECXML";

/** ECXML 3.2 - the version the document models natively, so every switch is at its newest setting.
 * @internal */
export const dialectV32: ECXmlDialect = Object.freeze({
  spec: ECSpec.V3_2,
  major: 3, minor: 2,
  namespace: `${ECXML_NAMESPACE_BASE}.3.2`,
  requiresThreeComponentVersion: true,
  versionComponents: 3,
  schemaAliasAttribute: "alias",
  referenceAliasAttribute: "alias",
  classElements: "typed",
  structArrayElement: true,
  navigationProperties: true,
  rangeAttributes: "camelCase",
  constraintBoundsAttribute: "multiplicity",
  strictMultiplicityGrammar: true,
  abstractConstraint: true,
  enumerationItems: true,
  enumeratorNames: true,
  enumerationStrictAttribute: "isStrict",
  kindOfQuantityItems: true,
  propertyCategoryItems: true,
  unitAndFormatItems: true,
});

/** ECXML 3.1 - 3.2 without explicit enumerator names, without the unit and format item kinds, and
 * with the older `strict` spelling on an enumeration.
 * @internal */
export const dialectV31: ECXmlDialect = Object.freeze({
  ...dialectV32,
  spec: ECSpec.V3_1,
  minor: 1,
  namespace: `${ECXML_NAMESPACE_BASE}.3.1`,
  requiresThreeComponentVersion: false,
  versionComponents: 2,
  strictMultiplicityGrammar: false,
  enumeratorNames: false,
  enumerationStrictAttribute: "strict",
  unitAndFormatItems: false,
});

/** ECXML 3.0 - 3.1 with the pre-alias attribute names, the pre-multiplicity endpoint spelling, and
 * no property categories. Closer to 2.0 than to 3.1 on those three points.
 * @internal */
export const dialectV30: ECXmlDialect = Object.freeze({
  ...dialectV31,
  spec: ECSpec.V3_0,
  minor: 0,
  namespace: `${ECXML_NAMESPACE_BASE}.3.0`,
  schemaAliasAttribute: "nameSpacePrefix",
  referenceAliasAttribute: "prefix",
  constraintBoundsAttribute: "cardinality",
  abstractConstraint: false,
  propertyCategoryItems: false,
});

/** ECXML 2.0 - the legacy vocabulary. Handled by its own reader and writer; this entry supplies the
 * shared switches and identifies the namespace.
 * @internal */
export const dialectV20: ECXmlDialect = Object.freeze({
  ...dialectV30,
  spec: ECSpec.V2_0,
  major: 2, minor: 0,
  namespace: `${ECXML_NAMESPACE_BASE}.2.0`,
  classElements: "flagged",
  structArrayElement: false,
  navigationProperties: false,
  rangeAttributes: "PascalCase",
  enumerationItems: false,
  kindOfQuantityItems: false,
});

/** Every dialect, newest first. @internal */
export const allDialects: ReadonlyArray<ECXmlDialect> = Object.freeze([dialectV32, dialectV31, dialectV30, dialectV20]);

/** The dialect for a spec version, or `undefined` when the version is not one this package writes. @internal */
export function dialectForSpec(spec: ECSpec): ECXmlDialect | undefined {
  return allDialects.find((dialect) => dialect.spec === spec);
}

/** The dialect a namespace URI declares, or `undefined` when it is not an ECXML namespace or names a
 * version this package does not read. @internal */
export function dialectForNamespace(namespace: string | undefined): ECXmlDialect | undefined {
  const match = namespace === undefined ? null : ECXML_NAMESPACE_PATTERN.exec(namespace);
  if (match === null)
    return undefined;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return allDialects.find((dialect) => dialect.major === major && dialect.minor === minor);
}

/** The ECXML namespace pattern; the captured groups carry the spec version. @internal */
export const ECXML_NAMESPACE_PATTERN = /Bentley\.ECXML\.(\d+)\.(\d+)$/;

/** Builds the name a pre-3.2 enumerator is given, which its XML does not carry. Mirrors native
 * (`ECEnumerator::DetermineName`): a string enumerator takes its value as its name, an integer one
 * takes the enumeration's name followed by the value. Both are then encoded to a valid EC name, so
 * a value like `"1/2"` becomes a usable identifier rather than an invalid one.
 * @internal */
export function synthesizeEnumeratorName(enumerationName: string, value: string | number): string {
  return typeof value === "string" ? value : `${enumerationName}${value}`;
}
