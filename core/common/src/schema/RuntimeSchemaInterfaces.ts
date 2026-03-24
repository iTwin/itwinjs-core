/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** The binary format version that this TS reader supports.
 * The C++ writer in imodel-native must produce this version (or negotiate down to it).
 * Frontend callers should always request this version explicitly via `PRAGMA runtime_schemas(N)`.
 * Backend callers may omit it since native and backend are bundled together.
 * @beta
 */
export const runtimeSchemasFormatVersion = 2;

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

/** Matches ec_ StrengthType values for relationships.
 * @beta
 */
export enum StrengthType {
  Referencing = 0,
  Holding = 1,
  Embedding = 2,
}

/** Matches ec_ direction values.
 * @beta
 */
export enum StrengthDirection {
  Forward = 1,
  Backward = 2,
}

/** Internal storage for a schema. Schemas own contiguous ranges of classes, enums, KoQs, and categories.
 * @internal
 */
export interface SchemaData {
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
  readonly viewRangeStart: number;
  readonly viewCount: number;
}

/** Internal storage for a class.
 * @internal
 */
export interface ClassData {
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
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
}

/** Shared, deduplicated property definition. Many properties may reference the same def.
 * @internal
 */
export interface PropertyDef {
  readonly nameSid: number;
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
  readonly arrayMinOccurs: number;
  readonly arrayMaxOccurs: number;
}

/** A reference from a specific class to a shared property definition.
 * @internal
 */
export interface PropertyRef {
  readonly defIdx: number;
  readonly labelSid: number;
  readonly prioritySid: number;
}

/** Internal storage for a relationship constraint.
 * @internal
 */
export interface RelConstraintData {
  readonly abstractConstraintIdx: number;
  readonly polymorphic: boolean;
  readonly classRefStart: number;
  readonly classRefCount: number;
}

/** Internal storage for an enumeration.
 * @internal
 */
export interface EnumerationData {
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
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly persistenceUnitSid: number;
  readonly presentationUnitsSid: number;
  readonly relativeError: number;
}

/** Internal storage for a PropertyCategory.
 * @internal
 */
export interface PropCategoryData {
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly priority: number;
}

/** Internal storage for an ECView. Views are queryable projections with properties but no
 * relationship semantics and no mixin application. The underlying ECSQL query is intentionally
 * omitted - runtime consumers only care about the view's property shape.
 * @internal
 */
export interface ViewData {
  readonly schemaIdx: number;
  readonly nameSid: number;
  readonly labelSid: number;
  readonly descriptionSid: number;
  readonly modifier: ClassModifier;
  readonly baseClassIdx: number;
  readonly ownPropStart: number;
  readonly ownPropCount: number;
}
