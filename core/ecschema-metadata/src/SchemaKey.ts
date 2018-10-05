/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { SchemaMatchType } from "./ECObjects";

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
export default class SchemaKey {
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
