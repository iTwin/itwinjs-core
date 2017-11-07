/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECVersion, SchemaKey, ECClassModifier } from "../ECObjects";
import { SchemaInterface, SchemaChildInterface } from "../Interfaces";
import { Class, MixinClass, EntityClass, StructClass, CustomAttributeClass } from "./Class";
import { Enumeration } from "./Enumeration";
import KindOfQuantity from "./KindOfQuantity";
import PropertyCategory from "./PropertyCategory";
import SchemaReadHelper from "../Deserialization/Helper";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { ICustomAttributeContainer, CustomAttributeSet } from "./CustomAttribute";
import { SchemaContext } from "../Context";

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
  public references?: SchemaInterface[];
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
    const newKoQ = new KindOfQuantity(name);

    if (!this._children)
      this._children = [];
    this._children.push(newKoQ);

    newKoQ.schema = this;
    return newKoQ;
  }

  /**
   *
   * @param name
   */
  public createPropertyCategory(name: string) {
    const newPropCat = new PropertyCategory(name);

    if (!this._children)
      this._children = [];
    this._children.push(newPropCat);

    newPropCat.schema = this;
    return newPropCat;
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
   * @param refSchema
   */
  public addReference(refSchema: SchemaInterface): void {
    // TODO validation of reference schema. For now just adding
    if (!this.references)
      this.references = [];
    this.references.push(refSchema);
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

  public static fromJson(jsonObj: object | string, context?: SchemaContext): ECSchema {
    let schema: ECSchema = new ECSchema();

    if (context) {
      const reader = new SchemaReadHelper(context);
      schema = reader.readSchema(schema, jsonObj);
    } else
      schema = SchemaReadHelper.to<ECSchema>(schema, jsonObj);

    return schema;
  }
}
