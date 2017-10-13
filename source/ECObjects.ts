/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

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
  Schema = 1,
  EntityClass = 2,
  CustomAttributeClass = 4,
  StructClass = 8,
  RelationshipClass = 16,
  AnyClass = 30,
  PrimitiveProperty = 32,
  StructProperty = 64,
  PrimitiveArrayProperty = 128,
  StructArrayProperty = 256,
  NavigationProperty = 512,
  AnyProperty = 992,
  SourceRelationshipConstraint = 1024,
  TargetRelationshipConstraint = 2048,
  AnyRelationshipConstraint = 3072,
  Any = 4095,
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

export const enum StrengthDirection {
  Forward = 1,
  Backward = 2,
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
    this.read = +read;
    this.write = +write;
    this.minor = +minor;
  }
}

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
