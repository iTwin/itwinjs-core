/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECVersion, ECName, ECClassModifier } from "../ECObjects";
import { SchemaInterface, SchemaChildInterface, SchemaKeyInterface } from "../ECInterfaces/Interfaces";
import { Class, MixinClass, EntityClass, StructClass, CustomAttributeClass } from "./Class";
import { Enumeration } from "./Enumeration";
import DeserializationHelper from "../Deserialization/Helper";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { ICustomAttributeContainer, CustomAttributeSet } from "./CustomAttribute";

const SCHEMAURL3_1 = "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema";

/**
 *
 */
export class ECSchema  implements SchemaInterface, ICustomAttributeContainer {
  private _immutable: boolean = false;
  public schemaKey: SchemaKey;
  public alias: string;
  public label?: string;
  public description?: string;
  public customAttributes?: CustomAttributeSet;
  private _children?: SchemaChildInterface[];

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
   * @param name
   * @param modifier
   */
  public createEntityClass(name: string, modifier?: ECClassModifier): EntityClass {
    const newEntity = new EntityClass(name);

    if (modifier)
      newEntity.modifier = modifier;

    if (!this._children)
      this._children = [];
    this._children.push(newEntity);

    newEntity.schema = this;

    return newEntity;
  }

  /**
   *
   * @param name
   */
  public createMixinClass(name: string): MixinClass {
    const newMixin = new MixinClass(name);

    if (!this._children)
      this._children = [];
    this._children.push(newMixin);

    newMixin.schema = this;

    return newMixin;
  }

  /**
   *
   * @param name
   * @param modifier
   */
  public createStructClass(name: string, modifier?: ECClassModifier): StructClass {
    const newStruct = new StructClass(name);

    if (modifier)
    newStruct.modifier = modifier;

    if (!this._children)
      this._children = [];
    this._children.push(newStruct);

    newStruct.schema = this;

    return newStruct;
  }

  /**
   *
   * @param name
   * @param modifier
   */
  public createCustomAttributeClass(name: string, modifier?: ECClassModifier): CustomAttributeClass {
    const newCAClass = new CustomAttributeClass(name);

    if (modifier)
      newCAClass.modifier = modifier;

    if (!this._children)
      this._children = [];
    this._children.push(newCAClass);

    newCAClass.schema = this;

    return newCAClass;
  }

  /**
   *
   * @param name
   */
  public createEnumeration(name: string): Enumeration {
    const newEnum = new Enumeration(name);

    if (!this._children)
      this._children = [];
    this._children.push(newEnum);

    newEnum.schema = this;
    return newEnum;
  }

  /**
   *
   * @param name
   */
  public createKindOfQuantity(name: string) {
    if (name)
      return;
    // TODO;
  }

  /**
   *
   * @param name
   */
  public createPropertyCategory(name: string) {
    if (name)
      return;
    // TODO;
  }

  /**
   * Searches the current schema for a schema child with a name matching, case-insensitive, the provided name.
   * @param name
   */
  public getChild<T extends SchemaChildInterface>(name: string): T | undefined {
    if (!this._children)
      return undefined;

    // Do case-insensitive search
    const foundChild = this._children.find((child) => child.name.toLowerCase() === name.toLowerCase());
    return foundChild as T;
  }

  /**
   * Searches the current schema for a class with a name matching, case-insensitive, the provided name.
   * @param name The name of the class to return.
   */
  public getClass<T extends Class>(name: string): T | undefined {
    return this.getChild<T>(name);
  }

  /**
   *
   */
  public getChildren<T extends SchemaChildInterface>(): T[] {
    if (!this._children)
      return [];

    return this._children as T[];
  }

  /**
   *
   */
  public getClasses(): Class[] {
    if (!this._children)
      return [];

    const classList = this._children.filter((child) => child instanceof Class);

    if (!classList)
      return [];

    return classList as Class[];
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    if (this._immutable) throw new ECObjectsError(ECObjectsStatus.ImmutableSchema);

    if (!jsonObj.$schema || jsonObj.$schema !== SCHEMAURL3_1)
      throw new ECObjectsError(ECObjectsStatus.MissingSchemaUrl);

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
export class SchemaKey implements SchemaKeyInterface {
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
