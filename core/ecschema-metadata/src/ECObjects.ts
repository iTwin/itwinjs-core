/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECObjectsError, ECObjectsStatus } from "./Exception";
import ECStringConstants from "./Constants";
export { PropertyType } from "./PropertyTypes";

// NEEDSWORK: This shim is currently required to use async iterators.  See https://github.com/Microsoft/TypeScript/issues/14151
if (!(Symbol as any).asyncIterator) {
  (Symbol as any).asyncIterator = Symbol.for("Symbol.asyncIterator");
}

export const enum ECClassModifier {
  None,
  Abstract,
  Sealed,
}

export const enum SchemaItemType {
  EntityClass,
  Mixin,
  StructClass,
  CustomAttributeClass,
  RelationshipClass,
  Enumeration,
  KindOfQuantity,
  PropertyCategory,
  Unit,
  InvertedUnit,
  Constant,
  Phenomenon,
  UnitSystem,
  Format,
}

/**
 * Primitive data types for ECProperties.
 */
export const enum PrimitiveType {
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
 */
// Matches the C++ enumeration values.
export const enum CustomAttributeContainerType {
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
 */
export const enum SchemaMatchType {
  // Find exact VersionRead, VersionWrite, VersionMinor match as well as Data
  Identical,
  // Find exact VersionRead, VersionWrite, VersionMinor match.
  Exact,
  // Find latest version with matching VersionRead and VersionWrite
  LatestWriteCompatible,
  // Find latest version.
  Latest,
  // Find latest version with matching VersionRead
  LatestReadCompatible,
}

/**
 * Identifer for an ECRelationshipConstraint. Used to determine the side of the relationship the constraint is representing.
 */
export const enum RelationshipEnd {
  Source = 0,
  Target = 1,
}

export const enum StrengthType {
  Referencing,
  Holding,
  Embedding,
}

export const enum StrengthDirection {
  Forward = 1,
  Backward = 2,
}

// Helper methods for going to/from string for the above Enumerations.

/**
 * Parses the provided string into an ECClassModifier if the string is a valid modifier.
 * @param modifier The modifier string to parse.
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
 */
export function parseSchemaItemType(type: string): SchemaItemType | undefined {
  const lowerType = type.toLowerCase();
  switch (lowerType) {
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
 */
export function schemaItemTypeToString(value: SchemaItemType): string {
  switch (value) {
    case SchemaItemType.EntityClass: return "EntityClass";
    case SchemaItemType.Mixin: return "Mixin";
    case SchemaItemType.StructClass: return "StructClass";
    case SchemaItemType.CustomAttributeClass: return "CustomAttributeClass";
    case SchemaItemType.RelationshipClass: return "RelationshipClass";
    case SchemaItemType.Enumeration: return "Enumeration";
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
 * Tries to parse the given string as one of the 11 primitive types.
 * @param type The primitive type string to parse.
 * @returns A valid PrimitiveType if successfully parsed, or undefined if the provided string is not a valid PrimitiveType.
 */
export function parsePrimitiveType(type: string): PrimitiveType | undefined {
  if (/^binary$/i.test(type)) return PrimitiveType.Binary;
  if (/^bool(ean)?$/i.test(type)) return PrimitiveType.Boolean;
  if (/^dateTime$/i.test(type)) return PrimitiveType.DateTime;
  if (/^double$/i.test(type)) return PrimitiveType.Double;
  if (/^int$/i.test(type)) return PrimitiveType.Integer;
  if (/^long$/i.test(type)) return PrimitiveType.Long;
  if (/^point2d$/i.test(type)) return PrimitiveType.Point2d;
  if (/^point3d$/i.test(type)) return PrimitiveType.Point3d;
  if (/^string$/i.test(type)) return PrimitiveType.String;
  if (/^Bentley\.Geometry\.Common\.IGeometry$/i.test(type)) return PrimitiveType.IGeometry;

  return undefined;
}

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
      containerType += "," + val;
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

export function parseRelationshipEnd(end: string): RelationshipEnd | undefined {
  const endLower = end.toLowerCase();
  switch (endLower) {
    case "source": return RelationshipEnd.Source;
    case "target": return RelationshipEnd.Target;
  }
  return undefined;
}

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
 */
export function parseStrength(strength: string): StrengthType | undefined {
  const lowerStrength = strength.toLowerCase();
  switch (lowerStrength) {
    case "referencing": return StrengthType.Referencing;
    case "holding": return StrengthType.Holding;
    case "embedding": return StrengthType.Embedding;
  }
  return undefined;
}

export function strengthToString(strength: StrengthType): string {
  switch (strength) {
    case StrengthType.Embedding: return "Embedding";
    case StrengthType.Holding: return "Holding";
    case StrengthType.Referencing: return "Referencing";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidStrength, `An invalid Strength has been provided.`);
  }
}

export function parseStrengthDirection(direction: string): StrengthDirection | undefined {
  const lowerDirection = direction.toLowerCase();
  switch (lowerDirection) {
    case "forward": return StrengthDirection.Forward;
    case "backward": return StrengthDirection.Backward;
  }
  return undefined;
}

export function strengthDirectionToString(direction: StrengthDirection): string {
  switch (direction) {
    case StrengthDirection.Forward: return "Forward";
    case StrengthDirection.Backward: return "Backward";
    default: throw new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, `An invalid StrengthDirection has been provided.`);
  }
}

/**
 *
 */
export class ECVersion {
  private _read: number = 0;
  private _write: number = 0;
  private _minor: number = 0;

  constructor(read?: number, write?: number, minor?: number) {
    if (undefined !== read) this._read = read;
    if (undefined !== write) this._write = write;
    if (undefined !== minor) this._minor = minor;

    if (this._read > 99 || this._read < 0 || this._write > 99 || this._write < 0 || this._minor > 99 || this._minor < 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion);
  }

  get read() { return this._read; }

  get write() { return this._write; }

  get minor() { return this._minor; }

  /**
   * Creates a string, in the format 'RR.ww.mm', representing this ECVersion.
   * @ note The default is to not pad with zeroes.
   * @param padZeroes If true, the returned string will strictly follow `RR.ww.mm` and add leading zeroes if necessary.
   */
  public toString(padZeroes: boolean = false): string {
    if (!padZeroes)
      return `${this.read}.${this.write}.${this.minor}`;

    const padWithZeroes = (num: number) => {
      return (num < 10 ? "0" : "") + num;
    };

    return `${padWithZeroes(this.read)}.${padWithZeroes(this.write)}.${padWithZeroes(this.minor)}`;
  }

  /**
   * Given a valid version string the
   * @param versionString A valid version string of the format, 'RR.ww.mm'.
   */
  public static fromString(versionString: string): ECVersion {
    const [read, write, minor] = versionString.split(".");
    if (!read)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The read version is missing from version string, ${versionString}`);

    if (!write)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The write version is missing from version string, ${versionString}`);

    if (!minor)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The minor version is missing from version string, ${versionString}`);

    return new ECVersion(+read, +write, +minor);
  }

  /**
   * Compares two schema versions.
   * @param rhs The schema to compare.
   * @return A negative number if this schema version is less than the given version, a positive number if greater, and 0 if are equalivalent.
   */
  public compare(rhv: ECVersion): number {
    if (this.read !== rhv.read)
      return this.read - rhv.read;

    if (this.write !== rhv.write)
      return this.write - rhv.write;

    return this.minor - rhv.minor;
  }
}

/**
 * An ECName is an invariant, string based, name is needed for an item in a schema.
 */
export class ECName {
  private _name: string;

  constructor(name: string) {
    const test: boolean = /^([a-zA-Z_]+[a-zA-Z0-9_]*)$/i.test(name);
    if (!test)
      throw new ECObjectsError(ECObjectsStatus.InvalidECName);
    this._name = name;
  }

  /**
   * @param newName string to validate
   * @return boolean whether newName is a valid ECName
   */
  public static validate(newName: string) {
    return /^([a-zA-Z_]+[a-zA-Z0-9_]*)$/i.test(newName);
  }

  get name() { return this._name; }
}

/**
 * The SchemaKey contains a Schemas name and version.
 */
export class SchemaKey {
  private _name: ECName;
  protected _version: ECVersion;
  // public checksum: number;
  // TODO: need to add a checksum

  constructor(name: string, version: ECVersion);
  constructor(name: string, readVersion?: number, writeVersion?: number, minorVersion?: number);
  constructor(name: string, readOrVersion?: number | ECVersion, writeVersion?: number, minorVersion?: number) {
    this._name = new ECName(name);
    if (readOrVersion !== undefined && readOrVersion instanceof ECVersion)
      this._version = readOrVersion;
    else
      this._version = new ECVersion(readOrVersion, writeVersion, minorVersion);
  }

  get version() { return this._version; }

  get name() { return this._name.name; }

  get readVersion() { return this.version.read; }

  get writeVersion() { return this.version.write; }

  get minorVersion() { return this.version.minor; }

  public toString() { return `${this.name}.${this.readVersion}.${this.writeVersion}.${this.minorVersion}`; }

  public static parseString(fullName: string) {
    const keyPieces = fullName.split(".");
    if (keyPieces.length !== 4) {
      throw new ECObjectsError(ECObjectsStatus.InvalidECName);
    }

    const schemaName = keyPieces[0];
    const readVer = Number(keyPieces[1]);
    const writeVer = Number(keyPieces[2]);
    const minorVer = Number(keyPieces[3]);
    return new SchemaKey(schemaName, new ECVersion(readVer, writeVer, minorVer));
  }

  /*
   * Compares two schema names, case-sensitive.
   * @return True if they match; otherwise, false.
   */
  public compareByName(rhs: SchemaKey | string | undefined): boolean {
    if (undefined === rhs || typeof (rhs) === "string")
      return rhs === this.name;
    return rhs.name === this.name;
  }

  /**
   * Compares two schema versions.
   * @param rhs The schema to compare.
   * @return A negative number if this schema version is less than the given version, a positive number if greater, and 0 if are equalivalent.
   */
  public compareByVersion(rhs: SchemaKey): number {
    return this.version.compare(rhs.version);
  }

  /**
   *
   * @param rhs The SchemaKey to compare with
   * @param matchType The match type to use for comparison.
   */
  public matches(rhs: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Identical): boolean {
    switch (matchType) {
      case SchemaMatchType.Identical:
        // TODO: if (this.checksum && rhs.checksum)
        // TODO:   return this.checksum === rhs.checksum;
        return this.compareByName(rhs.name) && this.readVersion === rhs.readVersion &&
          this.writeVersion === rhs.writeVersion && this.minorVersion === rhs.minorVersion;
      case SchemaMatchType.Exact:
        return this.compareByName(rhs.name) && this.readVersion === rhs.readVersion &&
          this.writeVersion === rhs.writeVersion && this.minorVersion === rhs.minorVersion;
      case SchemaMatchType.LatestReadCompatible:
        if (!this.compareByName(rhs.name))
          return false;

        if (rhs.readVersion !== this.readVersion)
          return false;

        if (this.writeVersion === rhs.writeVersion)
          return this.minorVersion >= rhs.minorVersion;

        return this.writeVersion > rhs.writeVersion;
      case SchemaMatchType.LatestWriteCompatible:
        return this.compareByName(rhs.name) && this.readVersion === rhs.readVersion &&
          this.writeVersion === rhs.writeVersion && this.minorVersion >= rhs.minorVersion;
      case SchemaMatchType.Latest:
        return this.compareByName(rhs.name);
      default:
        return false;
    }
  }
}

/**
 * The SchemaItemKey contains an items name, type, and its schema.
 */
export class SchemaItemKey {
  private _name: ECName;
  protected _schemaKey: SchemaKey;

  constructor(name: string, schema: SchemaKey);
  constructor(name: string, schema: SchemaKey); // tslint:disable-line
  constructor(name: string, schema: SchemaKey) {
    this._name = new ECName(name);
    this._schemaKey = schema;
  }

  get schemaKey() { return this._schemaKey; }
  get name() { return this._name.name; }
  get schemaName() { return this.schemaKey.name; }
  get fullName() { return this.schemaName + "." + this.name; }

  /**
   * Checks whether this SchemaItemKey matches the one provided.
   * @param rhs The SchemaItemKey to compare to this.
   */
  // TODO: Need to add a match type
  public matches(rhs: SchemaItemKey): boolean {
    if (rhs.name !== this.name)
      return false;

    if (!rhs.schemaKey.matches(this.schemaKey, SchemaMatchType.Latest))
      return false;

    return true;
  }

  public matchesFullName(rhs: string): boolean {
    const schemaVersion = this.schemaKey.version.toString().replace(/\./g, "\\.");
    const fullNameRegex = new RegExp(`^${this.schemaName}(\\.${schemaVersion})?[.:]${this.name}$`, "i");
    return fullNameRegex.test(rhs);
  }
}

const INT32_MAX = 2147483647;

/**
 *
 */
export class RelationshipMultiplicity {
  public static readonly zeroOne = new RelationshipMultiplicity(0, 1);
  public static readonly zeroMany = new RelationshipMultiplicity(0, INT32_MAX);
  public static readonly oneOne = new RelationshipMultiplicity(1, 1);
  public static readonly oneMany = new RelationshipMultiplicity(1, INT32_MAX);

  public readonly lowerLimit: number;
  public readonly upperLimit: number;

  constructor(lowerLimit: number, upperLimit: number) {
    this.lowerLimit = lowerLimit;
    this.upperLimit = upperLimit;
  }

  public static fromString(str: string): RelationshipMultiplicity | undefined {
    const matches = /^\(([0-9]*)\.\.([0-9]*|\*)\)$/.exec(str);
    if (matches === null || matches.length !== 3)
      return undefined;

    const lowerLimit = parseInt(matches[1], undefined);
    const upperLimit = matches[2] === "*" ? INT32_MAX : parseInt(matches[2], undefined);
    if (0 === lowerLimit && 1 === upperLimit)
      return RelationshipMultiplicity.zeroOne;
    else if (0 === lowerLimit && INT32_MAX === upperLimit)
      return RelationshipMultiplicity.zeroMany;
    else if (1 === lowerLimit && 1 === upperLimit)
      return RelationshipMultiplicity.oneOne;
    else if (1 === lowerLimit && INT32_MAX === upperLimit)
      return RelationshipMultiplicity.oneMany;

    return new RelationshipMultiplicity(lowerLimit, upperLimit);
  }

  public equals(rhs: RelationshipMultiplicity): boolean {
    return this.lowerLimit === rhs.lowerLimit && this.upperLimit === rhs.upperLimit;
  }

  public toString(): string {
    return `(${this.lowerLimit}..${this.upperLimit === INT32_MAX ? "*" : this.upperLimit})`;
  }
}
