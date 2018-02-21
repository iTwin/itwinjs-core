/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

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
import { ECVersion, SchemaChildKey, SchemaKey, ECClassModifier, StrengthType, RelatedInstanceDirection, PrimitiveType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { CustomAttributeContainerProps, CustomAttributeSet } from "./CustomAttribute";
import { SchemaContext } from "../Context";

const SCHEMAURL3_1 = "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema";

/**
 *
 */
export default class Schema implements CustomAttributeContainerProps {
  private _context?: SchemaContext;
  public readonly schemaKey: SchemaKey;
  protected _alias?: string;
  protected _label?: string;
  protected _description?: string;
  protected _customAttributes?: CustomAttributeSet;
  public readonly references: Schema[];
  private readonly _children: SchemaChild[];

  constructor(name?: string, readVersion?: number, writeVersion?: number, minorVersion?: number, alias?: string, label?: string, description?: string, context?: SchemaContext) {
    this.schemaKey = new SchemaKey(name, readVersion, writeVersion, minorVersion);
    this.references = [];
    this._children = [];
    this._alias = alias;
    this._label = label;
    this._description = description;
    this._context = context;
  }

  get name() { return this.schemaKey.name; }
  set name(name: string) { this.schemaKey.name = name; }

  get readVersion() { return this.schemaKey.readVersion; }
  set readVersion(version: number) { this.schemaKey.readVersion = version; }

  get writeVersion() { return this.schemaKey.writeVersion; }
  set writeVersion(version: number) { this.schemaKey.writeVersion = version; }

  get minorVersion() { return this.schemaKey.minorVersion; }
  set minorVersion(version: number) { this.schemaKey.minorVersion = version; }

  get alias() {return this._alias; }
  get label() {return this._label; }
  get description() {return this._description; }

  get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  /**
   * Creates a EntityClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createEntityClass(name: string, modifier?: ECClassModifier, label?: string, description?: string): Promise<EntityClass> {
     return this.createClass<EntityClass>(EntityClass, name, modifier, label, description);
  }

  public createEntityClassSync(name: string, modifier?: ECClassModifier, label?: string, description?: string): EntityClass {
     return this.createClass<EntityClass>(EntityClass, name, modifier, label, description);
  }

  /**
   * Creates a MixinClass with the provided name in this schema.
   * @param name
   */
  public async createMixinClass(name: string, label?: string, description?: string): Promise<MixinClass> {
    return this.createChild<MixinClass>(MixinClass, name, label, description);
  }

  public createMixinClassSync(name: string, label?: string, description?: string): MixinClass {
    return this.createChild<MixinClass>(MixinClass, name, label, description);
  }

  /**
   * Creates a StructClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createStructClass(name: string, modifier?: ECClassModifier, label?: string, description?: string): Promise<StructClass> {
    return this.createClass<StructClass>(StructClass, name, modifier, label, description);
  }

  public createStructClassSync(name: string, modifier?: ECClassModifier, label?: string, description?: string): StructClass {
    return this.createClass<StructClass>(StructClass, name, modifier, label, description);
  }

  /**
   * Creates a CustomAttributeClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createCustomAttributeClass(name: string, modifier?: ECClassModifier, label?: string, description?: string): Promise<CustomAttributeClass> {
    return this.createClass<CustomAttributeClass>(CustomAttributeClass, name, modifier, label, description);
  }

  public createCustomAttributeClassSync(name: string, modifier?: ECClassModifier, label?: string, description?: string): CustomAttributeClass {
    return this.createClass<CustomAttributeClass>(CustomAttributeClass, name, modifier, label, description);
  }

  /**
   * Creates a RelationshipClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  public async createRelationshipClass(name: string, strength?: StrengthType, strengthDirection?: RelatedInstanceDirection,  modifier?: ECClassModifier, label?: string, description?: string): Promise<RelationshipClass> {
    return this.createRelationshipClassSync(name, strength, strengthDirection, modifier, label, description);
  }

  public createRelationshipClassSync(name: string, strength?: StrengthType, strengthDirection?: RelatedInstanceDirection, modifier?: ECClassModifier, label?: string, description?: string): RelationshipClass {
    const child = new RelationshipClass(this, name, strength, strengthDirection, modifier, label, description);
    this.addChild(child);
    return child;
  }

  /**
   * Creates an Enumeration with the provided name in this schema.
   * @param name
   */
  public async createEnumeration(name: string, label?: string, description?: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String, isStrict?: boolean): Promise<Enumeration> {
    return this.createEnumerationSync(name, label, description, primitiveType, isStrict);
  }

  public createEnumerationSync(name: string, label?: string, description?: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String, isStrict?: boolean): Enumeration {
    const child = new Enumeration(this, name, label, description, primitiveType, isStrict);
    this.addChild(child);
    return child;
  }

  /**
   * Creates an KindOfQuantity with the provided name in this schema.
   * @param name
   */
  public async createKindOfQuantity(name: string, label?: string, description?: string): Promise<KindOfQuantity> {
    return this.createChild<KindOfQuantity>(KindOfQuantity, name, label, description);
  }

  public createKindOfQuantitySync(name: string, label?: string, description?: string): KindOfQuantity {
    return this.createChild<KindOfQuantity>(KindOfQuantity, name, label, description);
  }

  /**
   * Creates an PropertyCategory with the provided name in this schema.
   * @param name
   */
  public async createPropertyCategory(name: string, label?: string, description?: string): Promise<PropertyCategory> {
    return this.createChild<PropertyCategory>(PropertyCategory, name, label, description);
  }

  public createPropertyCategorySync(name: string, label?: string, description?: string): PropertyCategory {
    return this.createChild<PropertyCategory>(PropertyCategory, name, label, description);
  }

  // This method is private at the moment, but there is really no reason it can't be public... Need to make sure this is the way we want to handle this
  private createClass<T extends ECClass>(type: (new (schema: Schema, name: string, modifier?: ECClassModifier, label?: string, description?: string) => T), name: string, modifier?: ECClassModifier, label?: string, description?: string): T {
    const child = new type(this, name, modifier, label, description);
    this.addChild(child);
    return child;
  }

  // This method is private at the moment, but there is really no reason it can't be public... Need to make sure this is the way we want to handle this
  private createChild<T extends SchemaChild>(type: (new (schema: Schema, name: string, label?: string, description?: string) => T), name: string, label?: string, description?: string): T {
    const child = new type(this, name, label, description);
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

    return this.references.find((ref) => ref.schemaKey.name.toLowerCase() === refSchemaName.toLowerCase()) as T;
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
    if (!jsonObj.$schema || jsonObj.$schema !== SCHEMAURL3_1)
      throw new ECObjectsError(ECObjectsStatus.MissingSchemaUrl);

    if (jsonObj.name) this.name = jsonObj.name;
    if (jsonObj.alias) this._alias = jsonObj.alias;
    if (jsonObj.description) this._description = jsonObj.description;
    if (jsonObj.label) this._label = jsonObj.label;

    if (jsonObj.version) {
      if (!this.schemaKey.version)
        this.schemaKey.version = new ECVersion();
      this.schemaKey.version.fromString(jsonObj.version);
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
