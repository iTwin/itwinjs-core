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
 * All four versions are covered by this table. ECXML 2.0 needs the most switches - one `ECClass`
 * element carrying type flags rather than three typed elements, no first-class enumerations, kinds
 * of quantity, or property categories - but the walk and the emit are still one implementation each,
 * reading the switches. Turning legacy custom attributes into the first-class items 2.0 lacks, and
 * back, is a separate opt-in pass (`SchemaEC2Conversion`), not something a reader or writer does.
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
  /** Whether a missing or unparseable schema version is an error. Before 3.1 it is optional and
   * published legacy schemas do omit it; native reads those as `01.00.00`. */
  readonly requiresVersion: boolean;

  /** Attribute naming the schema's own alias on `ECSchema`. */
  readonly schemaAliasAttribute: "alias" | "nameSpacePrefix";
  /** Attribute naming a reference's alias on `ECSchemaReference`. */
  readonly referenceAliasAttribute: "alias" | "prefix";
  /** Whether a missing schema alias falls back to the schema name rather than being reported. The
   * `nameSpacePrefix` versions treat it as optional; 3.1 and later require it. */
  readonly aliasDefaultsToSchemaName: boolean;

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
  /** Whether a property may name an enumeration as its `typeName`. 2.0 has no enumerations, so the
   * writer emits the enumeration's backing primitive instead and the allowed values are lost. */
  readonly enumerationBackedProperties: boolean;
  /** Whether a property carries the `kindOfQuantity` attribute. 3.0 and later. */
  readonly kindOfQuantityAttribute: boolean;

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
  /** Whether references to the `Units` and `Formats` schemas are emitted. Before 3.2 those schemas
   * have no items to point at, so native skips the references and so does this writer. */
  readonly unitAndFormatReferences: boolean;

  /** Whether a custom attribute instance's `xmlns` carries the two-component legacy version
   * (`Schema.RR.mm`) rather than `Schema.RR.WW.mm`. 2.0 only. */
  readonly legacyCustomAttributeNamespace: boolean;
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
  requiresVersion: true,
  schemaAliasAttribute: "alias",
  referenceAliasAttribute: "alias",
  aliasDefaultsToSchemaName: false,
  classElements: "typed",
  structArrayElement: true,
  navigationProperties: true,
  rangeAttributes: "camelCase",
  enumerationBackedProperties: true,
  kindOfQuantityAttribute: true,
  constraintBoundsAttribute: "multiplicity",
  strictMultiplicityGrammar: true,
  abstractConstraint: true,
  enumerationItems: true,
  enumeratorNames: true,
  enumerationStrictAttribute: "isStrict",
  kindOfQuantityItems: true,
  propertyCategoryItems: true,
  unitAndFormatItems: true,
  unitAndFormatReferences: true,
  legacyCustomAttributeNamespace: false,
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
  unitAndFormatReferences: false,
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
  aliasDefaultsToSchemaName: true,
  requiresVersion: false,
  constraintBoundsAttribute: "cardinality",
  abstractConstraint: false,
  propertyCategoryItems: false,
});

/** ECXML 2.0 - the legacy vocabulary: one `ECClass` element carrying type flags, struct arrays as a
 * flag on `ECArrayProperty`, no navigation properties, and no first-class enumerations, kinds of
 * quantity, or property categories.
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
  enumerationBackedProperties: false,
  kindOfQuantityAttribute: false,
  enumerationItems: false,
  kindOfQuantityItems: false,
  legacyCustomAttributeNamespace: true,
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

/** Reads the legacy `cardinality` spelling ECXML 2.0 and 3.0 use for relationship endpoint bounds
 * into the `(lo..hi)` form the document stores. `N` and an omitted upper bound both mean unbounded.
 *
 * Native's parser is deliberately forgiving here, and this matches it: published legacy schemas
 * carry `(0,N)`, `(5)`, `1`, `unbounded`, and worse. Anything it cannot make sense of comes back
 * `undefined` and the caller keeps the source text for validation to report.
 * @internal */
export function parseLegacyCardinality(cardinality: string): string | undefined {
  const text = cardinality.replace(/\s/g, "");
  if (text.length === 0)
    return undefined;
  if (text === "1")
    return "(1..1)";
  if (/^(n|unbounded)$/i.test(text))
    return "(0..*)";

  if (text.startsWith("(")) {
    const bounded = /^\((\d+)(?:[,.]+(\d+|[nN*]))?/.exec(text);
    if (bounded === null)
      return undefined;
    const upper = bounded[2];
    return `(${bounded[1]}..${upper === undefined || /^[nN*]$/.test(upper) ? "*" : upper})`;
  }

  const lowerOnly = /^(\d+)/.exec(text);
  return lowerOnly === null ? undefined : `(0..${lowerOnly[1]})`;
}

/** Writes `(lo..hi)` back to the legacy `cardinality` spelling, which separates with a comma and
 * spells unbounded `N`.
 * @internal */
export function formatLegacyCardinality(bounds: { lowerLimit: number, upperLimit?: number }): string {
  return `(${bounds.lowerLimit},${bounds.upperLimit ?? "N"})`;
}
