/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass, { StructClass } from "./Class";
import CustomAttributeClass from "./CustomAttributeClass";
import Mixin from "./Mixin";
import EntityClass from "./EntityClass";
import RelationshipClass from "./RelationshipClass";
import SchemaChild from "./SchemaChild";
import Enumeration from "./Enumeration";
import KindOfQuantity from "./KindOfQuantity";
import PropertyCategory from "./PropertyCategory";
import SchemaReadHelper from "../Deserialization/Helper";
import { SchemaChildKey, SchemaKey, ECClassModifier } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { CustomAttributeContainerProps, CustomAttributeSet } from "./CustomAttribute";
import { SchemaContext } from "../Context";

const SCHEMAURL3_1 = "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema";

/**
 *
 */
export default class Schema implements CustomAttributeContainerProps {
  private _context?: SchemaContext;
  protected _schemaKey?: SchemaKey;
  public alias: string;
  public label?: string;
  public description?: string;
  public customAttributes?: CustomAttributeSet;
  public readonly references: Schema[];
  private readonly _children: SchemaChild[];
  /**
   * Constructs an empty Schema with the given name and version, (optionally) in a given context.
   * @param name The schema's name
   * @param readVersion The integer read (major) version of the schema
   * @param writeVersion The integer write version of the schema
   * @param minorVersion The integer minor version of the schema
   * @param context The SchemaContext that will control the lifetime of the schema
   */
  constructor(name: string, readVersion: number, writeVersion: number, minorVersion: number, context?: SchemaContext);
  /**
   * Constructs an empty Schema with the given key, (optionally) in a given context.
   * @param key A SchemaKey that uniquely identifies the schema
   * @param context The SchemaContext that will control the lifetime of the schema.
   */
  constructor(key: SchemaKey, context?: SchemaContext);  // tslint:disable-line:unified-signatures
  /**
   * Constructs an empty Schema (without a SchemaKey).
   * This should only be used when the schema name and version will be deserialized (via `fromJson()`) immediately after this Schema is instantiated.
   * @internal
   */
  constructor();
  constructor(nameOrKey?: SchemaKey | string, readVerOrCtx?: SchemaContext | number, writeVer?: number, minorVer?: number, otherCtx?: SchemaContext) {
    this._schemaKey = (typeof(nameOrKey) === "string") ? new SchemaKey(nameOrKey, readVerOrCtx as number, writeVer, minorVer) : nameOrKey;
    this._context = (typeof(readVerOrCtx) === "number") ? otherCtx : readVerOrCtx;
    this.references = [];
    this._children = [];
  }

  get schemaKey() {
    if (undefined === this._schemaKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema is missing the required 'name' attribute.`);
    return this._schemaKey;
  }

  get name() { return this.schemaKey.name; }
  set name(name: string) { this.schemaKey.name = name; }

  get readVersion() { return this.schemaKey.readVersion; }
  set readVersion(version: number) { this.schemaKey.readVersion = version; }

  get writeVersion() { return this.schemaKey.writeVersion; }
  set writeVersion(version: number) { this.schemaKey.writeVersion = version; }

  get minorVersion() { return this.schemaKey.minorVersion; }
  set minorVersion(version: number) { this.schemaKey.minorVersion = version; }

  /**
   * Creates a EntityClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createEntityClass(name: string, modifier?: ECClassModifier): Promise<EntityClass> { return this.createClass<EntityClass>(EntityClass, name, modifier); }
  public createEntityClassSync(name: string, modifier?: ECClassModifier): EntityClass { return this.createClass<EntityClass>(EntityClass, name, modifier); }

  /**
   * Creates a Mixin with the provided name in this schema.
   * @param name
   */
  public async createMixinClass(name: string): Promise<Mixin> { return this.createClass<Mixin>(Mixin, name); }
  public createMixinClassSync(name: string): Mixin { return this.createClass<Mixin>(Mixin, name); }

  /**
   * Creates a StructClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createStructClass(name: string, modifier?: ECClassModifier): Promise<StructClass> { return this.createClass<StructClass>(StructClass, name, modifier); }
  public createStructClassSync(name: string, modifier?: ECClassModifier): StructClass { return this.createClass<StructClass>(StructClass, name, modifier); }

  /**
   * Creates a CustomAttributeClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createCustomAttributeClass(name: string, modifier?: ECClassModifier): Promise<CustomAttributeClass> { return this.createClass<CustomAttributeClass>(CustomAttributeClass, name, modifier); }
  public createCustomAttributeClassSync(name: string, modifier?: ECClassModifier): CustomAttributeClass { return this.createClass<CustomAttributeClass>(CustomAttributeClass, name, modifier); }

  /**
   * Creates a RelationshipClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createRelationshipClass(name: string, modifier?: ECClassModifier): Promise<RelationshipClass> { return this.createClass<RelationshipClass>(RelationshipClass, name, modifier); }
  public createRelationshipClassSync(name: string, modifier?: ECClassModifier): RelationshipClass { return this.createClass<RelationshipClass>(RelationshipClass, name, modifier); }

  /**
   * Creates an Enumeration with the provided name in this schema.
   * @param name
   */
  public async createEnumeration(name: string): Promise<Enumeration> { return this.createChild<Enumeration>(Enumeration, name); }
  public createEnumerationSync(name: string): Enumeration { return this.createChild<Enumeration>(Enumeration, name); }

  /**
   * Creates an KindOfQuantity with the provided name in this schema.
   * @param name
   */
  public async createKindOfQuantity(name: string): Promise<KindOfQuantity> { return this.createChild<KindOfQuantity>(KindOfQuantity, name); }
  public createKindOfQuantitySync(name: string): KindOfQuantity { return this.createChild<KindOfQuantity>(KindOfQuantity, name); }

  /**
   * Creates an PropertyCategory with the provided name in this schema.
   * @param name
   */
  public async createPropertyCategory(name: string): Promise<PropertyCategory> { return this.createChild<PropertyCategory>(PropertyCategory, name); }
  public createPropertyCategorySync(name: string): PropertyCategory { return this.createChild<PropertyCategory>(PropertyCategory, name); }

  // This method is private at the moment, but there is really no reason it can't be public... Need to make sure this is the way we want to handle this
  private createClass<T extends ECClass>(type: (new (schema: Schema, name: string) => T), name: string, modifier?: ECClassModifier): T {
    const child = this.createChild(type, name);
    if (modifier) child.modifier = modifier;
    return child;
  }

  // This method is private at the moment, but there is really no reason it can't be public... Need to make sure this is the way we want to handle this
  private createChild<T extends SchemaChild>(type: (new (schema: Schema, name: string) => T), name: string): T {
    const child = new type(this, name);
    this.addChild(child);
    return child;
  }

  private getLocalChild(name: string): SchemaChild| undefined {
    // Case-insensitive search
    return this._children.find((child) => child.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Attempts to find a schema child with a name matching, case-insensitive, the provided name. It will look for the schema child in the context of this schema.
   * If the name is a full name, it will search in the reference schema matching the name.
   * @param name The name of the schema child to search for.
   */
  public async getChild<T extends SchemaChild>(name: string, includeReference?: boolean): Promise<T | undefined> {
    const [schemaName, childName] = SchemaChild.parseFullName(name);

    let foundChild;
    if (!schemaName || schemaName.toLowerCase() === this.name.toLowerCase()) {
      // Case-insensitive search
      foundChild = this.getLocalChild(childName);
      if (!foundChild && this._context) {
        // this._context.
      }

    } else if (includeReference) {
      const refSchema = await this.getReference(schemaName);
      if (!refSchema)
        return undefined;

      // Since we are only passing the childName to the reference schema it will not check its own referenced schemas.
      foundChild = refSchema.getChild<T>(childName, includeReference);
    }

    return Promise.resolve(foundChild ? foundChild as T : foundChild);
  }

  public getChildByKeySync<T extends SchemaChild>(key: SchemaChildKey, includeReferences?: boolean): T | undefined {
    key;
    includeReferences;
    // TODO: Deprecate?
    // let foundChild;
    // if (this.schemaKey.matches(key.schemaKey, SchemaMatchType.Exact)) {
    //   // Check the already loaded children
    //   foundChild = this._children.find((child) => key.compareByName(child.name));
    //   if (!foundChild)
    //     return foundChild; // undefined

    //   if (this._context)
    //     foundChild = this._context.getSchemaChild(key);
    // } else if (includeReferences) {
    //   // Given that the child should be located in a ref schema we need to actually ask that ref schema instead of looking in the context.
    //   // We do not want to accidentally load a child that matches but is not in a ref schema.

    //   let refSchema;
    //   if (key.schemaKey) {
    //     refSchema = this.references.find((schema) => key.schemaKey.compareByName(schema.schemaKey.name));
    //     if (refSchema)
    //       foundChild = refSchema.getChildByKeySync()
    //   }

    // }

    return undefined; // foundChild ? foundChild as T : foundChild;
  }

  public getChildSync<T extends SchemaChild>(name: string, includeReference?: boolean): T | undefined {
    name;
    includeReference;
    // TODO: Deprecate?
    return undefined;
  }

  /**
   *
   * @param child
   */
  public async addChild<T extends SchemaChild>(child: T): Promise<void> {
    if (undefined !== this.getLocalChild(child.name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateChild, `The SchemaChild ${child.name} cannot be added to the schema ${this.name} because it already exists`);

    this._children.push(child);
    return Promise.resolve();
  }

  public addChildSync<T extends SchemaChild>(child: T): void {
    if (undefined !== this.getLocalChild(child.name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateChild, `The SchemaChild ${child.name} cannot be added to the schema ${this.name} because it already exists`);

    this._children.push(child);
  }

  /**
   * Searches the current schema for a class with a name matching, case-insensitive, the provided name.
   * @param name The name of the class to return.
   */
  public getClass<T extends ECClass>(name: string): Promise<T | undefined> { return this.getChild<T>(name); }

  public getClassSync<T extends ECClass>(name: string): T | undefined { return this.getChildSync<T>(name); }

  /**
   *
   */
  public getChildren<T extends SchemaChild>(): T[] {
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
  public async addReference(refSchema: Schema): Promise<void> {
    // TODO validation of reference schema. For now just adding
    this.references.push(refSchema);
  }

  public addReferenceSync(refSchema: Schema): void {
    if (refSchema) { }

    throw new Error("Not implemented");
  }

  public async getReference<T extends Schema>(refSchemaName: string): Promise<T | undefined> {
    if (this.references.length === 0)
      return undefined;

    return this.references.find((ref) => ref.name.toLowerCase() === refSchemaName.toLowerCase()) as T;
  }

  public getReferenceSync<T extends Schema>(refSchemaName: string): T | undefined {
    if (refSchemaName) { }
    throw new Error("Not implemented");
  }

  /**
   *
   * @param jsonObj
   */
  public async fromJson(jsonObj: any): Promise<void> {
    if (SCHEMAURL3_1 !== jsonObj.$schema)
      throw new ECObjectsError(ECObjectsStatus.MissingSchemaUrl);

    if (!this._schemaKey) {
      if (undefined === jsonObj.name)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema is missing the required 'name' attribute.`);

      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema has an invalid 'name' attribute. It should be of type 'string'.`);

      this._schemaKey = new SchemaKey(jsonObj.name);

      if (undefined === jsonObj.version)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} is missing the required 'version' attribute.`);

      if (typeof(jsonObj.version) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'version' attribute. It should be of type 'string'.`);

      this.schemaKey.version.fromString(jsonObj.version);
    } else {
      if (undefined !== jsonObj.name) {
        if (typeof(jsonObj.name) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

        if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      }

      if (undefined !== jsonObj.version) {
        if (typeof(jsonObj.version) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'version' attribute. It should be of type 'string'.`);

        if (jsonObj.version !== this.schemaKey.version.toString())
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      }
    }

    if (undefined !== jsonObj.alias) {
      if (typeof(jsonObj.alias) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'alias' attribute. It should be of type 'string'.`);
      this.alias = jsonObj.alias;
    }

    if (undefined !== jsonObj.label) {
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this.label = jsonObj.label;
    }

    if (undefined !== jsonObj.description) {
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this.description = jsonObj.description;
    }
  }

  /////////////////////////
  //// Static Methods /////
  /////////////////////////

  public static async fromJson(jsonObj: object | string, context?: SchemaContext): Promise<Schema> {
    let schema: Schema = new Schema();

    if (context) {
      const reader = new SchemaReadHelper(context);
      schema = await reader.readSchema(schema, jsonObj);
    } else
      schema = await SchemaReadHelper.to<Schema>(schema, jsonObj);

    return schema;
  }
}
