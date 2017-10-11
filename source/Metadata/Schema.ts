/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECVersion, ECName } from "../ECObjects";
import { ECSchemaInterface } from "../ECInterfaces/Interfaces";
import DeserializationHelper from "../Deserialization/Helper";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 *
 */
export class ECSchema  implements ECSchemaInterface {
  private _immutable: boolean = false;
  public schemaKey: SchemaKey;
  public alias?: string;
  public label?: string;
  public description?: string;

  constructor(name?: string, readVersion?: number, writeVersion?: number, minorVersion?: number) {
    this.schemaKey = new SchemaKey(name, readVersion, writeVersion, minorVersion);
  }

  get name() { if (this.schemaKey) return this.schemaKey.name; }
  set name(name: string) {
    if (this._immutable)
      throw new ECObjectsError(ECObjectsStatus.ImmutableSchema);

    if (!this.schemaKey)
      this.schemaKey = new SchemaKey();

    this.schemaKey.name = name;
  }

  get readVersion() { if (this.schemaKey) return this.schemaKey.readVersion; }
  set readVersion(version: number) {
    if (this._immutable)
      throw new ECObjectsError(ECObjectsStatus.ImmutableSchema);

    if (!this.schemaKey)
      this.schemaKey = new SchemaKey();

    this.schemaKey.readVersion = version;
  }

  get writeVersion() { if (this.schemaKey) return this.schemaKey.writeVersion; }
  set writeVersion(version: number) {
    if (this._immutable)
      throw new ECObjectsError(ECObjectsStatus.ImmutableSchema);

    if (!this.schemaKey)
      this.schemaKey = new SchemaKey();

    this.schemaKey.writeVersion = version;
  }

  get minorVersion() { if (this.schemaKey) return this.schemaKey.minorVersion; }
  set minorVersion(version: number) {
    if (this._immutable)
      throw new ECObjectsError(ECObjectsStatus.ImmutableSchema);

    if (!this.schemaKey)
      this.schemaKey = new SchemaKey();

    this.schemaKey.minorVersion = version;
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    if (this._immutable) throw new ECObjectsError(ECObjectsStatus.ImmutableSchema);

    if (jsonObj.name) this.name = jsonObj.name;
    if (jsonObj.alias) this.alias = jsonObj.alias;
    if (jsonObj.description) this.description = jsonObj.description;
    if (jsonObj.label) this.label = jsonObj.label;

    if (jsonObj.version) {
      if (!this.schemaKey.version)
        this.schemaKey.version = new ECVersion();
      this.schemaKey.version.fromString(jsonObj.version);
    }
  }

  /////////////////////////
  //// Static Methods /////
  /////////////////////////

  public static fromString(jsonStr: string): ECSchema {
    let schema: ECSchema = new ECSchema();
    schema = DeserializationHelper.to<ECSchema>(schema, jsonStr);
    return schema;
  }

  public static fromObject(jsonObj: any): ECSchema {
    let schema: ECSchema = new ECSchema();
    schema = DeserializationHelper.to<ECSchema>(schema, jsonObj);
    return schema;
  }
}

/**
 *
 */
export class SchemaKey {
  private _name: ECName;
  public version: ECVersion;

  constructor(name?: string, readVersion?: number, writeVersion?: number, minorVersion?: number) {
    if (name)
      this.name = name;
    if (readVersion && writeVersion && minorVersion)
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
}
