/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECVersion, SchemaKey, ECClassModifier } from "../ECObjects";
import { SchemaInterface, SchemaChildInterface } from "../Interfaces";
import ECClass, { StructClass } from "./Class";
import CustomAttributeClass from "./CustomAttributeClass";
import MixinClass from "./MixinClass";
import EntityClass from "./EntityClass";
import RelationshipClass from "./RelationshipClass";
import SchemaChild from "./SchemaChild";
import Enumeration from "./Enumeration";
import KindOfQuantity from "./KindOfQuantity";
import PropertyCategory from "./PropertyCategory";
import SchemaReadHelper from "../Deserialization/Helper";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { CustomAttributeContainerProps, CustomAttributeSet } from "./CustomAttribute";
import { SchemaContext } from "../Context";

const SCHEMAURL3_1 = "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema";

/**
 *
 */
export default class ECSchema  implements SchemaInterface, CustomAttributeContainerProps {
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

    newEntity.setSchema(this);

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

    newMixin.setSchema(this);

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

    newStruct.setSchema(this);

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

    newCAClass.setSchema(this);

    return newCAClass;
  }

  /**
   *
   */
  public createRelationshipClass(name: string, modifier?: ECClassModifier): RelationshipClass {
    const newRelClass = new RelationshipClass(name);

    if (modifier)
      newRelClass.modifier = modifier;

    if (!this._children)
      this._children = [];
    this._children.push(newRelClass);

    newRelClass.setSchema(this);

    return newRelClass;
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

    newEnum.setSchema(this);
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

    newKoQ.setSchema(this);
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

    newPropCat.setSchema(this);
    return newPropCat;
  }

  /**
   * Attempts to find a schema child with a name matching, case-insensitive, the provided name. It will look for the schema child in the context of this schema.
   * If the name is a full name, it will search in the reference schema matching the name.
   * @param name The name of the schema child to search for.
   */
  public getChild<T extends SchemaChildInterface>(name: string): T | undefined {
    const [schemaName, childName] = SchemaChild.parseFullName(name);

    let foundChild;
    if (!schemaName || schemaName.toLowerCase() === this.name.toLowerCase()) {
      if (!this._children)
      return undefined;

      // Do case-insensitive search
      foundChild = this._children.find((child) => child.name.toLowerCase() === childName.toLowerCase());
    } else {
      const refSchema = this.getReference(schemaName);
      if (!refSchema)
        return undefined;

      // Since we are only passing the childName to the reference schema it will not check its own referenced schemas.
      foundChild = refSchema.getChild<T>(childName);
    }

    return foundChild ? foundChild as T : foundChild;
  }

  /**
   * Searches the current schema for a class with a name matching, case-insensitive, the provided name.
   * @param name The name of the class to return.
   */
  public getClass<T extends ECClass>(name: string): T | undefined {
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
  public getClasses(): ECClass[] {
    if (!this._children)
      return [];

    const classList = this._children.filter((child) => child instanceof ECClass);

    if (!classList)
      return [];

    return classList as ECClass[];
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

  public getReference<T extends SchemaInterface>(refSchemaName: string): T | undefined {
    if (!this.references)
      return undefined;
    return this.references.find((ref) => ref.schemaKey.name.toLowerCase() === refSchemaName.toLowerCase()) as T;
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
