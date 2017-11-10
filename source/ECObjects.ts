/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKeyInterface } from "./Interfaces";
import { ECObjectsError, ECObjectsStatus } from "./Exception";

export const enum ECClassModifier {
  None,
  Abstract,
  Sealed,
}

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
 * Parses the provided string into an ECClassModifier if the string is a valid modifier.
 * @param modifier The modifier string to parse
 */
export function parseClassModifier(modifier: string): ECClassModifier {
  const lowerModifier = modifier.toLowerCase();
  if (/Abstract/i.test(lowerModifier))
    return ECClassModifier.Abstract;
  else if (/None/i.test(lowerModifier))
    return ECClassModifier.None;
  else if (/Sealed/i.test(lowerModifier))
    return ECClassModifier.Sealed;

  throw new ECObjectsError(ECObjectsStatus.InvalidModifier, `${modifier} is not a valid ECClassModifier.`);
}

/**
 * Parses the given string into the appropriate CustomAttributeContainerType if the string is valid.
 * @param type The container type string to parse.
 */
export function parseCustomAttributeContainerType(type: string): CustomAttributeContainerType {
  const typeTokens = type.split(/[|,;]+/);

  let containerType = 0;

  typeTokens.forEach((typeToken) => {
    if (typeToken.length === 0)
      return;

    typeToken = typeToken.toLowerCase();

    if (/Schema/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.Schema;
    else if (/EntityClass/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.EntityClass;
    else if (/CustomAttributeClass/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.CustomAttributeClass;
    else if (/StructClass/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.StructClass;
    else if (/RelationshipClass/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.RelationshipClass;
    else if (/AnyClass/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.AnyClass;
    else if (/PrimitiveProperty/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.PrimitiveProperty;
    else if (/StructProperty/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.StructProperty;
    else if (/ArrayProperty/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.PrimitiveArrayProperty;
    else if (/StructArrayProperty/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.StructArrayProperty;
    else if (/NavigationProperty/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.NavigationProperty;
    else if (/AnyProperty/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.AnyProperty;
    else if (/SourceRelationshipConstraint/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.SourceRelationshipConstraint;
    else if (/TargetRelationshipConstraint/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.TargetRelationshipConstraint;
    else if (/AnyRelationshipConstraint/i.test(typeToken))
      containerType = containerType | CustomAttributeContainerType.AnyRelationshipConstraint;
    else if (/Any/i.test(typeToken))
      containerType = CustomAttributeContainerType.Any;
    else
      throw new ECObjectsError(ECObjectsStatus.InvalidContainerType, `${typeToken} is not a valid CustomAttributeContainerType value.`);
  });

  return containerType as CustomAttributeContainerType;
}

export function containerTypeToString(type: CustomAttributeContainerType): string {

  const testContainerTypeValue = (compareType: CustomAttributeContainerType, otherType: CustomAttributeContainerType) => {
    return (compareType === (compareType & otherType));
  };

  if (testContainerTypeValue(CustomAttributeContainerType.Any, type))
    return "Any";

  const setOrAppend = (str: string, val: string) => {
    if (str.length === 0)
      str = val;
    else
      str += "," + val;
  };

  const containerType: string = "";
  if (testContainerTypeValue(CustomAttributeContainerType.Schema, type))
    setOrAppend(containerType, "Schema");

  if (testContainerTypeValue(CustomAttributeContainerType.AnyClass, type))
    setOrAppend(containerType, "AnyClass");
  else {
    if (testContainerTypeValue(CustomAttributeContainerType.EntityClass, type))
      setOrAppend(containerType, "EntityClass");
    if (testContainerTypeValue(CustomAttributeContainerType.CustomAttributeClass, type))
      setOrAppend(containerType, "CustomAttributeClass");
    if (testContainerTypeValue(CustomAttributeContainerType.StructClass, type))
      setOrAppend(containerType, "StructClass");
    if (testContainerTypeValue(CustomAttributeContainerType.RelationshipClass, type))
      setOrAppend(containerType, "RelationshipClass");
  }

  if (testContainerTypeValue(CustomAttributeContainerType.AnyProperty, type))
    setOrAppend(containerType, "AnyProperty")
  else {
    if (testContainerTypeValue(CustomAttributeContainerType.PrimitiveProperty, type))
      setOrAppend(containerType, "PrimitiveProperty");
    if (testContainerTypeValue(CustomAttributeContainerType.StructProperty, type))
      setOrAppend(containerType, "StructProperty");
    if (testContainerTypeValue(CustomAttributeContainerType.PrimitiveArrayProperty, type))
      setOrAppend(containerType, "PrimitiveArrayProperty");
    if (testContainerTypeValue(CustomAttributeContainerType.StructArrayProperty, type))
      setOrAppend(containerType, "StructArrayProperty");
    if (testContainerTypeValue(CustomAttributeContainerType.NavigationProperty, type))
      setOrAppend(containerType, "NavigationProperty");
  }

  if (testContainerTypeValue(CustomAttributeContainerType.AnyRelationshipConstraint, type))
    setOrAppend(containerType, "AnyRelationshipConstraint");
  else {
    if (testContainerTypeValue(CustomAttributeContainerType.SourceRelationshipConstraint, type))
      setOrAppend(containerType, "SourceRelationshipConstraint");
    if (testContainerTypeValue(CustomAttributeContainerType.TargetRelationshipConstraint, type))
      setOrAppend(containerType, "TargetRelationshipConstraint");
  }

  return containerType;
}

export const enum RelationshipEnd {
  Source = 0,
  Target = 1,
}

export const enum StrengthType {
  Referencing,
  Holding,
  Embedding,
}

export function parseStrength(strength: string): StrengthType {
  const lowerStrength = strength.toLowerCase();
  if (/Referencing/i.test(lowerStrength))
    return StrengthType.Referencing;
  else if (/Holding/i.test(lowerStrength))
    return StrengthType.Holding;
  else if (/Embedding/i.test(lowerStrength))
    return StrengthType.Embedding;

  throw new ECObjectsError(ECObjectsStatus.InvalidStrength, `${strength} is not a valid StrengthType`);
}

export const enum StrengthDirection {
  Forward = 1,
  Backward = 2,
}

export function parseStrengthDirection(direction: string): StrengthDirection {
  const lowerDirection = direction.toLowerCase();
  if (/Forward/i.test(lowerDirection))
    return StrengthDirection.Forward;
  else if (/Backward/i.test(lowerDirection))
    return StrengthDirection.Backward;

  throw new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, `${direction} is not a valid StrengthDirection.`);
}

/**
 *
 */
export class ECVersion {
  private _read: number;
  private _write: number;
  private _minor: number;

  constructor(read?: number, write?: number, minor?: number) {
    if (read || read === 0) this.read = read;
    if (write || write === 0) this.write = write;
    if (minor || minor === 0) this.minor = minor;
  }

  get read() { return this._read ? this._read : 0; }
  set read(read: number) {
    if (read > 99 || read < 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion);
    this._read = read;
  }

  get write() { return this._write ? this._write : 0; }
  set write(write: number) {
    if (write > 99 || write < 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion);
    this._write = write;
  }

  get minor() { return this._minor ? this._minor : 0; }
  set minor(minor: number) {
    if (minor > 99 || minor < 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion);
    this._minor = minor;
  }

  /**
   * Returns a string, in the format 'RR.ww.mm', of this ECVersion.
   */
  public toString(): string {
    return `${this.read}.${this.write}.${this.minor}`;
  }

  /**
   * Given a valid version string the
   * @param versionString A valid version string of the format, 'RR.ww.mm'.
   */
  public fromString(versionString: string): void {
    const [read, write, minor] = versionString.split(".");
    if (!read)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The read version if missing from version string, ${versionString}`);
    this.read = +read;

    if (!write)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The write version if missing from version string, ${versionString}`);
    this.write = +write;

    if (!minor)
      throw new ECObjectsError(ECObjectsStatus.InvalidECVersion, `The minor version if missing from version string, ${versionString}`);
    this.minor = +minor;
  }
}

/**
 *
 */
export class ECName {
  private _name: string;

  constructor(name: string) {
    this.name = name;
  }

  get name() { return this._name; }
  set name(name: string) {
    const test: boolean = /^([a-zA-Z_.]+[a-zA-Z0-9_.]*)$/i.test(name);
    if (!test)
      throw new ECObjectsError(ECObjectsStatus.InvalidECName);
    this._name = name;
  }
}

/**
 * The SchemaKey object contains
 */
export class SchemaKey implements SchemaKeyInterface {
  private _name: ECName;
  public version: ECVersion;
  public checksum: number;
  // TODO: need to add a hash

  constructor(name?: string, readVersion?: number, writeVersion?: number, minorVersion?: number) {
    if (name)
      this.name = name;

    this.version = new ECVersion(readVersion, writeVersion, minorVersion);
  }

  get name() { return this._name.name; }
  set name(name: string) {
    this._name = new ECName(name);
  }

  get readVersion() { return this.version.read; }
  set readVersion(version: number) {
    this.version.read = version;
  }

  get writeVersion() { return this.version.write; }
  set writeVersion(version: number) {
    this.version.write = version;
  }

  get minorVersion() { return this.version.minor; }
  set minorVersion(version: number) {
    this.version.minor = version;
  }

  public toString() { return `${this.name}.${this.readVersion}.${this.writeVersion}.${this.minorVersion}`; }

  /*
   * Compares two schema names and returns whether or not they match. Comparison is case-sensitive.
   */
  public compareByName(rhs: SchemaKey | string): boolean {
    if (typeof(rhs) === "string")
      return rhs === this.name;
    return rhs.name === this.name;
  }

  /**
   *
   * @param rhs The SchemaKey to compare with
   * @param matchType The match type to use for comparison.
   */
  public matches(rhs: SchemaKeyInterface, matchType: SchemaMatchType = SchemaMatchType.Identical): boolean {
    switch (matchType) {
      case SchemaMatchType.Identical:
        if (this.checksum && rhs.checksum)
          return this.checksum === rhs.checksum;
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
        return this.compareByName (rhs.name) && this.readVersion === rhs.readVersion &&
                this.writeVersion === rhs.writeVersion && this.minorVersion >= rhs.minorVersion;
      case SchemaMatchType.Latest:
          return this.compareByName(rhs.name);
      default:
          return false;
    }
  }
}

const UINT_MAX = 4294967295;

/**
 *
 */
export class RelationshipMultiplicity {
  public static readonly zeroOne = new RelationshipMultiplicity(0, 1);
  public static readonly zeroMany = new RelationshipMultiplicity(0, UINT_MAX);
  public static readonly oneOne = new RelationshipMultiplicity(1, 1);
  public static readonly oneMany = new RelationshipMultiplicity(1, UINT_MAX);

  public lowerLimit: number;
  public upperLimit: number;

  constructor(lowerLimit: number, upperLimit: number) {
    this.lowerLimit = lowerLimit;
    this.upperLimit = upperLimit;
  }

  public static fromString(str: string): RelationshipMultiplicity | undefined {
    const matches = /^\(([0-9]*)\.\.([0-9]*|\*)\)$/.exec(str);
    if (matches === null || matches.length !== 3)
      return undefined;

    const lowerLimit = parseInt(matches[1], undefined);
    const upperLimit = matches[2] === "*" ? UINT_MAX : parseInt(matches[2], undefined);
    if (0 === lowerLimit && 1 === upperLimit)
      return RelationshipMultiplicity.zeroOne;
    else if (0 === lowerLimit && UINT_MAX === upperLimit)
      return RelationshipMultiplicity.zeroMany;
    else if (1 === lowerLimit && 1 === upperLimit)
      return RelationshipMultiplicity.oneOne;
    else if (1 === lowerLimit && UINT_MAX === upperLimit)
      return RelationshipMultiplicity.oneMany;

    return new RelationshipMultiplicity(lowerLimit, upperLimit);
  }

  public equals(rhs: RelationshipMultiplicity): boolean {
    return this.lowerLimit === rhs.lowerLimit && this.upperLimit === rhs.upperLimit;
  }
}
