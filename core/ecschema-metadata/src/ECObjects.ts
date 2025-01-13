/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { ECStringConstants } from "./Constants";
import { ECObjectsError, ECObjectsStatus } from "./Exception";

export { PropertyType } from "./PropertyTypes";

// NEEDSWORK: This shim is currently required to use async iterators.  See https://github.com/Microsoft/TypeScript/issues/14151
if (!(Symbol as any).asyncIterator) {
  (Symbol as any).asyncIterator = Symbol.for("Symbol.asyncIterator");
}

/** @beta */
export enum ECClassModifier {
  None,
  Abstract,
  Sealed,
}

/**
 * An enumeration that has all the schema item type names as values
 * @beta */
export enum SchemaItemType {
  EntityClass = "EntityClass",
  Mixin = "Mixin",
  StructClass = "StructClass",
  CustomAttributeClass = "CustomAttributeClass",
  RelationshipClass = "RelationshipClass",
  Enumeration = "Enumeration",
  KindOfQuantity = "KindOfQuantity",
  PropertyCategory = "PropertyCategory",
  Unit = "Unit",
  InvertedUnit = "InvertedUnit",
  Constant = "Constant",
  Phenomenon = "Phenomenon",
  UnitSystem = "UnitSystem",
  Format = "Format",
}

/**
 * Primitive data types for ECProperties.
 * @beta
 */
export enum PrimitiveType {
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

/**
 * Defines the valid CustomAttribute container types.
 * @beta
 */
export enum CustomAttributeContainerType {
  Schema = (0x0001 << 0),
  EntityClass = (0x0001 << 1),
  CustomAttributeClass = (0x0001 << 2),
  StructClass = (0x0001 << 3),
  RelationshipClass = (0x0001 << 4),
  AnyClass = EntityClass | CustomAttributeClass | StructClass | RelationshipClass,
  PrimitiveProperty = (0x0001 << 5),
  StructProperty = (0x0001 << 6),
  PrimitiveArrayProperty = (0x0001 << 7),
  StructArrayProperty = (0x0001 << 8),
  NavigationProperty = (0x0001 << 9),
  AnyProperty = PrimitiveProperty | StructProperty | PrimitiveArrayProperty | StructArrayProperty | NavigationProperty,
  SourceRelationshipConstraint = (0x0001 << 10),
  TargetRelationshipConstraint = (0x0001 << 11),
  AnyRelationshipConstraint = SourceRelationshipConstraint | TargetRelationshipConstraint,
  Any = Schema | AnyClass | AnyProperty | AnyRelationshipConstraint,
}

/**
 * Defines what sort of match should be used when locating a schema.
 * @beta
 */
export enum SchemaMatchType {
  /*
  * Find exact VersionRead, VersionWrite, VersionMinor match as well as Data. NOTE data is not yet matched
  * @deprecated in 4.10 Use Exact instead.
  */
  Identical,
  /* Find exact VersionRead, VersionWrite, VersionMinor match. */
  Exact,
  /* Find latest version with matching VersionRead and VersionWrite */
  LatestWriteCompatible,
  /* Find latest version. */
  Latest,
  /* Find latest version with matching VersionRead */
  LatestReadCompatible,
}

/**
 * Identifer for an ECRelationshipConstraint. Used to determine the side of the relationship the constraint is representing.
 * @beta
 */
export enum RelationshipEnd {
  Source = 0,
  Target = 1,
}

/** @beta */
export enum StrengthType {
  Referencing,
  Holding,
  Embedding,
}

/** @beta */
export enum StrengthDirection {
  Forward = 1,
  Backward = 2,
}

// Helper methods for going to/from string for the above Enumerations.

/**
 * Parses the provided string into an ECClassModifier if the string is a valid modifier.
 * @param modifier The modifier string to parse.
 * @beta
 */
export function parseClassModifier(modifier: string): ECClassModifier | undefined {
  const lowerModifier = modifier.toLowerCase();
  switch (lowerModifier) {
    case "abstract": return ECClassModifier.Abstract;
    case "none": return ECClassModifier.None;
    case "sealed": return ECClassModifier.Sealed;
  }
  return undefined;
}

/**
 * @return A string representing the provided ECClassModifier. If the modifier is not valid, an empty string is returned.
 * @beta
 */
export function classModifierToString(modifier: ECClassModifier): string {
  switch (modifier) {
    case ECClassModifier.Abstract: return "Abstract";
    case ECClassModifier.None: return "None";
    case ECClassModifier.Sealed: return "Sealed";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidModifier, "An invalid ECClassModifier has been provided.");
  }
}

/**
 * Tries to parse the given string as one of the 8 schema item types.
 * @param type The schema item type string to parse.
 * @returns A valid SchemaItemType if successfully parsed. Otherwise, undefined if the provided string is not a valid SchemaItemType.
 * @beta
 */
export function parseSchemaItemType(type: string): SchemaItemType | undefined {
  switch (type.toLowerCase()) {
    case "entityclass": return SchemaItemType.EntityClass;
    case "mixin": return SchemaItemType.Mixin;
    case "structclass": return SchemaItemType.StructClass;
    case "customattributeclass": return SchemaItemType.CustomAttributeClass;
    case "relationshipclass": return SchemaItemType.RelationshipClass;
    case "enumeration": return SchemaItemType.Enumeration;
    case "kindofquantity": return SchemaItemType.KindOfQuantity;
    case "propertycategory": return SchemaItemType.PropertyCategory;
    case "unit": return SchemaItemType.Unit;
    case "invertedunit": return SchemaItemType.InvertedUnit;
    case "constant": return SchemaItemType.Constant;
    case "phenomenon": return SchemaItemType.Phenomenon;
    case "unitsystem": return SchemaItemType.UnitSystem;
    case "format": return SchemaItemType.Format;
  }
  return undefined;
}

/**
 * Converts a valid SchemaItemType to a display string.
 * @param value The SchemaItemType to stringify.
 * @return A string representing the provided SchemaItemType. If the type is not valid, an empty string is returned.
 * @beta
 * @deprecated in 4.6.0 SchemaItemType is a string enum so just use it directly
 */
export function schemaItemTypeToString(value: SchemaItemType): string {
  return value; // TODO: Remove
}

/** @internal */
export function schemaItemTypeToXmlString(value: SchemaItemType): string {
  switch (value) {
    case SchemaItemType.EntityClass: return "ECEntityClass";
    case SchemaItemType.Mixin: return "ECEntityClass";
    case SchemaItemType.StructClass: return "ECStructClass";
    case SchemaItemType.CustomAttributeClass: return "ECCustomAttributeClass";
    case SchemaItemType.RelationshipClass: return "ECRelationshipClass";
    case SchemaItemType.Enumeration: return "ECEnumeration";
    case SchemaItemType.KindOfQuantity: return "KindOfQuantity";
    case SchemaItemType.PropertyCategory: return "PropertyCategory";
    case SchemaItemType.Unit: return "Unit";
    case SchemaItemType.InvertedUnit: return "InvertedUnit";
    case SchemaItemType.Constant: return "Constant";
    case SchemaItemType.Phenomenon: return "Phenomenon";
    case SchemaItemType.UnitSystem: return "UnitSystem";
    case SchemaItemType.Format: return "Format";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, "An invalid SchemaItemType has been provided.");
  }
}

/**
 * Tries to parse the given string as one of the 10 primitive types.
 * @param type The primitive type string to parse.
 * @returns A valid PrimitiveType if successfully parsed, or undefined if the provided string is not a valid PrimitiveType.
 * @beta
 */
export function parsePrimitiveType(type: string): PrimitiveType | undefined {
  switch (type.toLowerCase()) {
    case "binary": return PrimitiveType.Binary;
    case "boolean": case "bool": return PrimitiveType.Boolean;
    case "datetime": return PrimitiveType.DateTime;
    case "double": return PrimitiveType.Double;
    case "int": return PrimitiveType.Integer;
    case "long": return PrimitiveType.Long;
    case "point2d": return PrimitiveType.Point2d;
    case "point3d": return PrimitiveType.Point3d;
    case "string": return PrimitiveType.String;
    case "bentley.geometry.common.igeometry": return PrimitiveType.IGeometry;
  }

  return undefined;
}

/** @beta */
export function primitiveTypeToString(type: PrimitiveType): string {
  switch (type) {
    case PrimitiveType.Binary: return "binary";
    case PrimitiveType.Boolean: return "boolean";
    case PrimitiveType.DateTime: return "dateTime";
    case PrimitiveType.Double: return "double";
    case PrimitiveType.Integer: return "int";
    case PrimitiveType.IGeometry: return "Bentley.Geometry.Common.IGeometry";
    case PrimitiveType.Long: return "long";
    case PrimitiveType.Point2d: return "point2d";
    case PrimitiveType.Point3d: return "point3d";
    case PrimitiveType.String: return "string";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidPrimitiveType, "An invalid PrimitiveType has been provided.");
  }
}

/**
 * Parses the given string into the appropriate CustomAttributeContainerType if the string is valid.
 * @param type The container type string to parse.
 * @beta
 */
export function parseCustomAttributeContainerType(type: string): CustomAttributeContainerType | undefined {
  const typeTokens = type.split(/[|,;]+/);

  let containerType = 0;

  typeTokens.forEach((typeToken) => {
    typeToken = typeToken.trim();
    if (typeToken.length === 0)
      return;

    typeToken = typeToken.toLowerCase();
    switch (typeToken) {
      case "schema":
        containerType = containerType | CustomAttributeContainerType.Schema;
        break;
      case "entityclass":
        containerType = containerType | CustomAttributeContainerType.EntityClass;
        break;
      case "customattributeclass":
        containerType = containerType | CustomAttributeContainerType.CustomAttributeClass;
        break;
      case "structclass":
        containerType = containerType | CustomAttributeContainerType.StructClass;
        break;
      case "relationshipclass":
        containerType = containerType | CustomAttributeContainerType.RelationshipClass;
        break;
      case "anyclass":
        containerType = containerType | CustomAttributeContainerType.AnyClass;
        break;
      case "primitiveproperty":
        containerType = containerType | CustomAttributeContainerType.PrimitiveProperty;
        break;
      case "structproperty":
        containerType = containerType | CustomAttributeContainerType.StructProperty;
        break;
      case "arrayproperty":
        containerType = containerType | CustomAttributeContainerType.PrimitiveArrayProperty;
        break;
      case "structarrayproperty":
        containerType = containerType | CustomAttributeContainerType.StructArrayProperty;
        break;
      case "navigationproperty":
        containerType = containerType | CustomAttributeContainerType.NavigationProperty;
        break;
      case "anyproperty":
        containerType = containerType | CustomAttributeContainerType.AnyProperty;
        break;
      case "sourcerelationshipconstraint":
        containerType = containerType | CustomAttributeContainerType.SourceRelationshipConstraint;
        break;
      case "targetrelationshipconstraint":
        containerType = containerType | CustomAttributeContainerType.TargetRelationshipConstraint;
        break;
      case "anyrelationshipconstraint":
        containerType = containerType | CustomAttributeContainerType.AnyRelationshipConstraint;
        break;
      case "any":
        containerType = containerType | CustomAttributeContainerType.Any;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidContainerType, `${typeToken} is not a valid CustomAttributeContainerType value.`);
    }
  });

  return containerType as CustomAttributeContainerType;
}

/**
 * Creates a string representing a valid CustomAttributeContainerType.
 * @param value The CustomAttributeContainerType to stringify.
 * @return A string representing the provided CustomAttributeContainerType. If the type is not valid, an empty string is returned.
 * @beta
 */
export function containerTypeToString(type: CustomAttributeContainerType): string {

  const testContainerTypeValue = (compareType: CustomAttributeContainerType, otherType: CustomAttributeContainerType) => {
    return (compareType === (compareType & otherType));
  };

  if (testContainerTypeValue(CustomAttributeContainerType.Any, type))
    return ECStringConstants.CONTAINERTYPE_ANY;

  let containerType = "";
  const setOrAppend = (val: string) => {
    if (containerType.length === 0)
      containerType = val;
    else
      containerType = `${containerType}, ${val}`;
  };

  if (testContainerTypeValue(CustomAttributeContainerType.Schema, type))
    setOrAppend("Schema");

  if (testContainerTypeValue(CustomAttributeContainerType.AnyClass, type))
    setOrAppend("AnyClass");
  else {
    if (testContainerTypeValue(CustomAttributeContainerType.EntityClass, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_ENTITYCLASS);
    if (testContainerTypeValue(CustomAttributeContainerType.CustomAttributeClass, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_CUSTOMATTRIBUTECLASS);
    if (testContainerTypeValue(CustomAttributeContainerType.StructClass, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_STRUCTCLASS);
    if (testContainerTypeValue(CustomAttributeContainerType.RelationshipClass, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_RELATIONSHIPCLASS);
  }

  if (testContainerTypeValue(CustomAttributeContainerType.AnyProperty, type))
    setOrAppend(ECStringConstants.CONTAINERTYPE_ANYPROPERTY);
  else {
    if (testContainerTypeValue(CustomAttributeContainerType.PrimitiveProperty, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_PRIMITIVEPROPERTY);
    if (testContainerTypeValue(CustomAttributeContainerType.StructProperty, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_STRUCTPROPERTY);
    if (testContainerTypeValue(CustomAttributeContainerType.PrimitiveArrayProperty, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_PRIMITIVEARRAYPROPERTY);
    if (testContainerTypeValue(CustomAttributeContainerType.StructArrayProperty, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_STRUCTARRAYPROPERTY);
    if (testContainerTypeValue(CustomAttributeContainerType.NavigationProperty, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_NAVIGATIONPROPERTY);
  }

  if (testContainerTypeValue(CustomAttributeContainerType.AnyRelationshipConstraint, type))
    setOrAppend(ECStringConstants.CONTAINERTYPE_ANYRELATIONSHIPCONSTRAINT);
  else {
    if (testContainerTypeValue(CustomAttributeContainerType.SourceRelationshipConstraint, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_SOURCERELATIONSHIPCONSTRAINT);
    if (testContainerTypeValue(CustomAttributeContainerType.TargetRelationshipConstraint, type))
      setOrAppend(ECStringConstants.CONTAINERTYPE_TARGETRELATIONSHIPCONSTRAINT);
  }

  return containerType;
}

/** @beta */
export function parseRelationshipEnd(end: string): RelationshipEnd | undefined {
  switch (end.toLowerCase()) {
    case "source": return RelationshipEnd.Source;
    case "target": return RelationshipEnd.Target;
  }
  return undefined;
}

/** @beta */
export function relationshipEndToString(end: RelationshipEnd): string {
  switch (end) {
    case RelationshipEnd.Source: return ECStringConstants.RELATIONSHIP_END_SOURCE;
    case RelationshipEnd.Target: return ECStringConstants.RELATIONSHIP_END_TARGET;
    default: throw new ECObjectsError(ECObjectsStatus.InvalidRelationshipEnd, `An invalid RelationshipEnd has been provided.`);
  }
}

/**
 * Takes a string representing a StrengthType, will parse it and return the corresponding StrengthType.
 * @throws ECObjectsStatus.InvalidStrength if the provided string that is not valid
 * @param strength
 * @beta
 */
export function parseStrength(strength: string): StrengthType | undefined {
  switch (strength.toLowerCase()) {
    case "referencing": return StrengthType.Referencing;
    case "holding": return StrengthType.Holding;
    case "embedding": return StrengthType.Embedding;
  }
  return undefined;
}

/** @beta */
export function strengthToString(strength: StrengthType): string {
  switch (strength) {
    case StrengthType.Embedding: return "Embedding";
    case StrengthType.Holding: return "Holding";
    case StrengthType.Referencing: return "Referencing";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidStrength, `An invalid Strength has been provided.`);
  }
}

/** @beta */
export function parseStrengthDirection(direction: string): StrengthDirection | undefined {
  switch (direction.toLowerCase()) {
    case "forward": return StrengthDirection.Forward;
    case "backward": return StrengthDirection.Backward;
  }
  return undefined;
}

/** @beta */
export function strengthDirectionToString(direction: StrengthDirection): string {
  switch (direction) {
    case StrengthDirection.Forward: return "Forward";
    case StrengthDirection.Backward: return "Backward";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, `An invalid StrengthDirection has been provided.`);
  }
}
