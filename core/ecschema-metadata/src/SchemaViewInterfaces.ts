/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** The binary format version that this TS reader supports.
 * The C++ writer in imodel-native must produce this version (or negotiate down to it).
 * Frontend callers should always request this version explicitly via `PRAGMA schema_view(N)`.
 * Backend callers may omit it since native and backend are bundled together.
 * @beta
 */
export const schemaViewFormatVersion = 1;

/** Matches ec_Class.Type values in ECDb.
 * @beta
 */
export enum ClassType {
  Entity = 0,
  Relationship = 1,
  Struct = 2,
  CustomAttribute = 3,
  /** Not stored in ec_Class.Type - synthesized from IsMixin CA during cache population. */
  Mixin = 4,
  /** Synthesized from QueryView CA (EC <3.3) or first-class ECView element (EC >=3.3). */
  View = 5,
}

/** Matches ec_Class.Modifier values.
 * @beta
 */
export enum ClassModifier {
  None = 0,
  Abstract = 1,
  Sealed = 2,
}

/** Matches ec_Property.Kind values.
 * @beta
 */
export enum PropertyKind {
  Primitive = 0,
  Struct = 1,
  PrimitiveArray = 2,
  StructArray = 3,
  Navigation = 4,
}

/** Matches ec_ PrimitiveType values.
 * @beta
 */
export enum RuntimePrimitiveType {
  Uninitialized = 0x00,
  Binary = 0x101,
  Boolean = 0x201,
  DateTime = 0x301,
  Double = 0x401,
  Integer = 0x501,
  Long = 0x601,
  Point2d = 0x701,
  Point3d = 0x801,
  String = 0x901,
  IGeometry = 0xa01,
}

// StrengthType and StrengthDirection are re-used from ECObjects.ts (same values).
import { StrengthDirection, StrengthType } from "./ECObjects";
export { StrengthType, StrengthDirection } from "./ECObjects";

/** Internal storage for a schema. Schemas own contiguous ranges of classes, enums, KoQs, and categories.
 * @internal
 */
export interface SchemaData {
  /** Row ID from ec_Schema - use with ECDbMeta queries, e.g. `SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId = ?`. */
  readonly ecInstanceId: number;
  readonly nameSid: number;
  readonly aliasSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly versionRead: number;
  readonly versionWrite: number;
  readonly versionMinor: number;
  readonly classRangeStart: number;
  readonly classCount: number;
  readonly enumRangeStart: number;
  readonly enumCount: number;
  readonly koqRangeStart: number;
  readonly koqCount: number;
  readonly catRangeStart: number;
  readonly catCount: number;
  readonly isHidden: boolean;
}

/** Internal storage for a class.
 * @internal
 */
export interface ClassData {
  /** Row ID from ec_Class - use with ECDbMeta queries, e.g. `SELECT * FROM meta.ECClassDef WHERE ECInstanceId = ?`. */
  readonly ecInstanceId: number;
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly type: ClassType;
  readonly modifier: ClassModifier;
  readonly baseClassIdx: number;
  readonly mixinStartIdx: number;
  readonly mixinCount: number;
  readonly ownPropStart: number;
  readonly ownPropCount: number;
  readonly strength: StrengthType;
  readonly strengthDirection: StrengthDirection;
  readonly sourceConstraintIdx: number;
  readonly targetConstraintIdx: number;
  readonly isHidden: boolean;
}

/** Shared, deduplicated property definition. Many properties may reference the same def.
 * The definition holds the structural shape of a property - name, kind, type, cross-references.
 * Per-class overrides (label, priority) live in `PropertyRef`, not here, so that properties
 * with identical shape but different labels still share a single definition.
 * @internal
 */
export interface PropertyDef {
  readonly nameSid: number;
  readonly descriptionSid: number;
  readonly kind: PropertyKind;
  readonly primitiveType: RuntimePrimitiveType;
  readonly extTypeSid: number;
  readonly enumIdx: number;
  readonly koqIdx: number;
  readonly structClassIdx: number;
  readonly navRelClassIdx: number;
  readonly navDirection: StrengthDirection;
  readonly categoryIdx: number;
  readonly isReadOnly: boolean;
  readonly isHidden: boolean;
  readonly arrayMinOccurs: number | undefined;
  readonly arrayMaxOccurs: number | undefined;
}

/** A reference from a specific class to a shared property definition.
 * Label and priority are per-reference (not per-definition) because EC allows class overrides
 * of these attributes. A property displayed in ClassA may have a different label than in ClassB
 * even though the underlying definition (name, type, etc.) is identical.
 *
 * `ecInstanceId` is the ec_Property.Id row ID, stored here (not on PropertyDef) because each
 * class-property pair has a unique row even when the structural definition is deduplicated.
 * @internal
 */
export interface PropertyRef {
  /** Row ID from ec_Property - use with ECDbMeta queries, e.g. `SELECT * FROM meta.ECPropertyDef WHERE ECInstanceId = ?`. */
  readonly ecInstanceId: number;
  readonly defIdx: number;
  readonly labelSid: number;
  readonly priority: number;
}

/** Internal storage for a relationship constraint.
 * @internal
 */
export interface RelConstraintData {
  readonly abstractConstraintIdx: number;
  readonly polymorphic: boolean;
  readonly multiplicityLower: number;
  readonly multiplicityUpper: number;
  readonly roleLabelSid: number;
  readonly classRefStart: number;
  readonly classRefCount: number;
}

/** Internal storage for an enumeration.
 * @internal
 */
export interface EnumerationData {
  /** Row ID from ec_Enumeration - use with ECDbMeta queries, e.g. `SELECT * FROM meta.ECEnumerationDef WHERE ECInstanceId = ?`. */
  readonly ecInstanceId: number;
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly primitiveType: RuntimePrimitiveType;
  readonly isStrict: boolean;
  readonly enumeratorStart: number;
  readonly enumeratorCount: number;
}

/** Internal storage for an enumerator.
 * @internal
 */
export interface EnumeratorData {
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly value: number | string;
}

/** Internal storage for a KindOfQuantity.
 * @internal
 */
export interface KoqData {
  /** Row ID from ec_KindOfQuantity - use with ECDbMeta queries, e.g. `SELECT * FROM meta.ECKindOfQuantityDef WHERE ECInstanceId = ?`. */
  readonly ecInstanceId: number;
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly persistenceUnitSid: number;
  readonly presentationFormatsSid: number;
  readonly relativeError: number;
}

/** Internal storage for a PropertyCategory.
 * @internal
 */
export interface PropCategoryData {
  /** Row ID from ec_PropertyCategory - use with ECDbMeta queries, e.g. `SELECT * FROM meta.ECPropertyCategoryDef WHERE ECInstanceId = ?`. */
  readonly ecInstanceId: number;
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly priority: number;
}
