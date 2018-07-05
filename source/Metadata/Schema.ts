/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass, { StructClass } from "./Class";
import CustomAttributeClass from "./CustomAttributeClass";
import Mixin from "./Mixin";
import EntityClass from "./EntityClass";
import RelationshipClass from "./RelationshipClass";
import SchemaItem from "./SchemaItem";
import Enumeration from "./Enumeration";
import KindOfQuantity from "./KindOfQuantity";
import Unit from "./Unit";
import PropertyCategory from "./PropertyCategory";
import SchemaReadHelper from "../Deserialization/Helper";
import { SchemaKey, ECClassModifier, PrimitiveType, ECVersion } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { CustomAttributeContainerProps, CustomAttributeSet } from "./CustomAttribute";
import { SchemaContext } from "../Context";
import UnitSystem from "./UnitSystem";
import Phenomenon from "./Phenomenon";
import Format from "./Format";
import Constant from "./Constant";
import InvertedUnit from "./InvertedUnit";

const SCHEMAURL3_2 = "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema";

/**
 *
 */
export default class Schema implements CustomAttributeContainerProps {
  private _context?: SchemaContext;
  protected _schemaKey?: SchemaKey;
  protected _alias?: string;
  protected _label?: string;
  protected _description?: string;
  protected _customAttributes?: CustomAttributeSet;
  public readonly references: Schema[];
  private readonly _items: SchemaItem[];
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
   * @hidden
   */
  constructor();
  constructor(nameOrKey?: SchemaKey | string, readVerOrCtx?: SchemaContext | number, writeVer?: number, minorVer?: number, otherCtx?: SchemaContext) {
    this._schemaKey = (typeof(nameOrKey) === "string") ? new SchemaKey(nameOrKey, new ECVersion(readVerOrCtx as number, writeVer, minorVer)) : nameOrKey;
    this._context = (typeof(readVerOrCtx) === "number") ? otherCtx : readVerOrCtx;
    this.references = [];
    this._items = [];
  }

  get schemaKey() {
    if (undefined === this._schemaKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema is missing the required 'name' attribute.`);
    return this._schemaKey;
  }

  get name() { return this.schemaKey.name; }

  get readVersion() { return this.schemaKey.readVersion; }

  get writeVersion() { return this.schemaKey.writeVersion; }

  get minorVersion() { return this.schemaKey.minorVersion; }

  get alias() {return this._alias; }
  get label() {return this._label; }
  get description() {return this._description; }

  get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  /**
   * Creates a EntityClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  protected async createEntityClass(name: string, modifier?: ECClassModifier): Promise<EntityClass> {
     return this.createClass<EntityClass>(EntityClass, name, modifier);
  }

  protected createEntityClassSync(name: string, modifier?: ECClassModifier): EntityClass {
     return this.createClass<EntityClass>(EntityClass, name, modifier);
  }

  /**
   * Creates a Mixin with the provided name in this schema.
   * @param name
   */
  protected async createMixinClass(name: string): Promise<Mixin> { return this.createClass<Mixin>(Mixin, name); }
  protected createMixinClassSync(name: string): Mixin { return this.createClass<Mixin>(Mixin, name); }

  /**
   * Creates a StructClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  protected async createStructClass(name: string, modifier?: ECClassModifier): Promise<StructClass> {
    return this.createClass<StructClass>(StructClass, name, modifier);
  }

  protected createStructClassSync(name: string, modifier?: ECClassModifier): StructClass {
    return this.createClass<StructClass>(StructClass, name, modifier);
  }

  /**
   * Creates a CustomAttributeClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  protected async createCustomAttributeClass(name: string, modifier?: ECClassModifier): Promise<CustomAttributeClass> {
    return this.createClass<CustomAttributeClass>(CustomAttributeClass, name, modifier);
  }

  protected createCustomAttributeClassSync(name: string, modifier?: ECClassModifier): CustomAttributeClass {
    return this.createClass<CustomAttributeClass>(CustomAttributeClass, name, modifier);
  }

  /**
   * Creates a RelationshipClass with the provided name in this schema.
   * @param name
   * @param modifier
   */
  protected async createRelationshipClass(name: string, modifier?: ECClassModifier): Promise<RelationshipClass> {
    return this.createRelationshipClassSync(name, modifier);
  }

  protected createRelationshipClassSync(name: string, modifier?: ECClassModifier): RelationshipClass {
    return this.createClass<RelationshipClass>(RelationshipClass, name, modifier);
  }

  /**
   * Creates an Enumeration with the provided name in this schema.
   * @param name
   */
  protected async createEnumeration(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Promise<Enumeration> {
    return this.createEnumerationSync(name, primitiveType);
  }

  protected createEnumerationSync(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Enumeration {
    const item = new Enumeration(this, name, primitiveType);
    this.addItem(item);
    return item;
  }

  /**
   * Creates an KindOfQuantity with the provided name in this schema.
   * @param name
   */
  protected async createKindOfQuantity(name: string): Promise<KindOfQuantity> {
    return this.createItem<KindOfQuantity>(KindOfQuantity, name);
  }

  protected createKindOfQuantitySync(name: string): KindOfQuantity {
    return this.createItem<KindOfQuantity>(KindOfQuantity, name);
  }

  /**
   * Creates a Constant with the provided name in this schema.
   * @param name
   */
  protected async createConstant(name: string): Promise<Constant> {
    return this.createItem<Constant>(Constant, name);
  }

  protected createConstantSync(name: string): Constant {
    return this.createItem<Constant>(Constant, name);
  }

  /**
   * Creates a Inverted Unit with the provided name in this schema.
   * @param name
   */
  protected async createInvertedUnit(name: string): Promise<InvertedUnit> {
    return this.createItem<InvertedUnit>(InvertedUnit, name);
  }

  protected createInvertedUnitSync(name: string): InvertedUnit {
    return this.createItem<InvertedUnit>(InvertedUnit, name);
  }

  /**
   * Creates an Format with the provided name in this schema.
   * @param name
   */
  protected async createFormat(name: string): Promise<Format> {
    return this.createItem<Format>(Format, name);
  }

  protected createFormatSync(name: string): Format {
    return this.createItem<Format>(Format, name);
  }

  /**
   * Creates a UnitSystem with the provided name in this schema.
   * @param name
   */
  protected async createUnitSystem(name: string): Promise<UnitSystem> {
    return this.createItem<UnitSystem>(UnitSystem, name);
  }

  protected createUnitSystemSync(name: string): UnitSystem {
    return this.createItem<UnitSystem>(UnitSystem, name);
  }

  /**
   * Creates a Phenomenon with the provided name in this schema.
   * @param name
   */
  protected async createPhenomenon(name: string): Promise<Phenomenon> {
    return this.createItem<Phenomenon>(Phenomenon, name);
  }

  protected createPhenomenonSync(name: string): Phenomenon {
    return this.createItem<Phenomenon>(Phenomenon, name);
  }

  /**
   * Creates a Unit with the provided name in this schema.
   * @param name
   */
  protected async createUnit(name: string): Promise<Unit> {
    return this.createItem<Unit>(Unit, name);
  }

  protected createUnitSync(name: string): Unit {
    return this.createItem<Unit>(Unit, name);
  }

  /**
   * Creates an PropertyCategory with the provided name in this schema.
   * @param name
   */
  protected async createPropertyCategory(name: string): Promise<PropertyCategory> {
    return this.createItem<PropertyCategory>(PropertyCategory, name);
  }

  protected createPropertyCategorySync(name: string): PropertyCategory {
    return this.createItem<PropertyCategory>(PropertyCategory, name);
  }

  // This method is private at the moment, but there is really no reason it can't be public... Need to make sure this is the way we want to handle this
  private createClass<T extends ECClass>(type: (new (schema: Schema, name: string, modifier?: ECClassModifier) => T), name: string, modifier?: ECClassModifier): T {
    const item = new type(this, name, modifier);
    this.addItem(item);
    return item;
  }

  // This method is private at the moment, but there is really no reason it can't be public... Need to make sure this is the way we want to handle this
  private createItem<T extends SchemaItem>(type: (new (schema: Schema, name: string) => T), name: string): T {
    const item = new type(this, name);
    this.addItem(item);
    return item;
  }

  private getLocalItem(name: string): SchemaItem| undefined {
    // Case-insensitive search
    return this._items.find((item) => item.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Attempts to find a schema item with a name matching, case-insensitive, the provided name. It will look for the schema item in the context of this schema.
   * If the name is a full name, it will search in the reference schema matching the name.
   * @param name The name of the schema item to search for.
   */
  public async getItem<T extends SchemaItem>(name: string, includeReference?: boolean): Promise<T | undefined> {
    const [schemaName, itemName] = SchemaItem.parseFullName(name);

    let foundItem;
    if (!schemaName || schemaName.toLowerCase() === this.name.toLowerCase()) {
      // Case-insensitive search
      foundItem = this.getLocalItem(itemName);
      if (!foundItem && this._context) {
        // this._context.
      }

    } else if (includeReference) {
      const refSchema = await this.getReference(schemaName);
      if (!refSchema)
        return undefined;

      // Since we are only passing the itemName to the reference schema it will not check its own referenced schemas.
      foundItem = refSchema.getItem<T>(itemName, includeReference);
    }

    return Promise.resolve(foundItem ? foundItem as T : foundItem);
  }

  /**
   * Attempts to find a schema item with a name matching, case-insensitive, the provided name. It will look for the schema item in the context of this schema.
   * If the name is a full name, it will search in the reference schema matching the name.
   * @param name The name of the schema item to search for.
   */
  public getItemSync<T extends SchemaItem>(name: string, includeReference?: boolean): T | undefined {
    const [schemaName, itemName] = SchemaItem.parseFullName(name);

    let foundItem;
    if (!schemaName || schemaName.toLowerCase() === this.name.toLowerCase()) {
      // Case-insensitive search
      foundItem = this.getLocalItem(itemName);
      if (!foundItem && this._context) {
        // this._context.
      }

    } else if (includeReference) {
      const refSchema = this.getReferenceSync(schemaName);
      if (!refSchema)
        return undefined;

      // Since we are only passing the itemName to the reference schema it will not check its own referenced schemas.
      foundItem = refSchema.getItemSync<T>(itemName, includeReference);
    }

    return foundItem ? foundItem as T : foundItem;
  }

  /**
   *
   * @param item
   */
  protected async addItem<T extends SchemaItem>(item: T): Promise<void> {
    if (undefined !== this.getLocalItem(item.name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateItem, `The SchemaItem ${item.name} cannot be added to the schema ${this.name} because it already exists`);

    this._items.push(item);
    return Promise.resolve();
  }

  protected addItemSync<T extends SchemaItem>(item: T): void {
    if (undefined !== this.getLocalItem(item.name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateItem, `The SchemaItem ${item.name} cannot be added to the schema ${this.name} because it already exists`);

    this._items.push(item);
  }

  /**
   * Searches the current schema for a class with a name matching, case-insensitive, the provided name.
   * @param name The name of the class to return.
   */
  public getClass<T extends ECClass>(name: string): Promise<T | undefined> { return this.getItem<T>(name); }

  /**
   * Searches the current schema for a class with a name matching, case-insensitive, the provided name.
   * @param name The name of the class to return.
   */
  public getClassSync<T extends ECClass>(name: string): T | undefined { return this.getItemSync<T>(name); }

  /**
   *
   */
  public getItems<T extends SchemaItem>(): T[] {
    if (!this._items)
      return [];

    return this._items as T[];
  }

  /**
   *
   */
  public getClasses(): ECClass[] {
    if (!this._items)
      return [];

    const classList = this._items.filter((item) => item instanceof ECClass);

    if (!classList)
      return [];

    return classList as ECClass[];
  }

  /**
   *
   * @param refSchema
   */
  protected async addReference(refSchema: Schema): Promise<void> {
    // TODO validation of reference schema. For now just adding
    this.addReferenceSync(refSchema);
  }

  protected addReferenceSync(refSchema: Schema): void {
    this.references.push(refSchema);
  }

  public async getReference<T extends Schema>(refSchemaName: string): Promise<T | undefined> {
    if (this.references.length === 0)
      return undefined;

    return this.references.find((ref) => ref.name.toLowerCase() === refSchemaName.toLowerCase()) as T;
  }

  public getReferenceSync<T extends Schema>(refSchemaName: string): T | undefined {
    if (this.references.length === 0)
      return undefined;

    return this.references.find((ref) => ref.name.toLowerCase() === refSchemaName.toLowerCase()) as T;
  }

  /**
   *
   * @param jsonObj
   */
  public async fromJson(jsonObj: any): Promise<void> {
    this.schemaFromJson(jsonObj);
  }

  /**
   *
   * @param jsonObj
   */
  public fromJsonSync(jsonObj: any): void {
    this.schemaFromJson(jsonObj);
  }

  /**
   *
   * @param jsonObj
   */
  public schemaFromJson(jsonObj: any) {
    if (SCHEMAURL3_2 !== jsonObj.$schema) {
      throw new ECObjectsError(ECObjectsStatus.MissingSchemaUrl, "Schema namespace '$(jsonObj.$schema)' is not supported.");
    }

    if (!this._schemaKey) {
      if (undefined === jsonObj.name)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema is missing the required 'name' attribute.`);

      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema has an invalid 'name' attribute. It should be of type 'string'.`);

      const schemaName = jsonObj.name;

      if (undefined === jsonObj.version)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${schemaName} is missing the required 'version' attribute.`);

      if (typeof(jsonObj.version) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${schemaName} has an invalid 'version' attribute. It should be of type 'string'.`);

      const version = ECVersion.fromString(jsonObj.version);
      this._schemaKey = new SchemaKey(schemaName, version);
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
      this._alias = jsonObj.alias;
    }

    if (undefined !== jsonObj.label) {
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label;
    }

    if (undefined !== jsonObj.description) {
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description;
    }
  }

  /////////////////////////
  //// Static Methods /////
  /////////////////////////

  public static async fromJson(jsonObj: object | string, context?: SchemaContext): Promise<Schema> {
    let schema: Schema = new Schema();

    const reader = new SchemaReadHelper(context);
    schema = await reader.readSchema(schema, jsonObj);

    return schema;
  }

  public static fromJsonSync(jsonObj: object | string, context?: SchemaContext): Schema {
    let schema: Schema = new Schema();

    const reader = new SchemaReadHelper(context);
    schema = reader.readSchemaSync(schema, jsonObj);

    return schema;
  }
}

/** @hidden
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * We cannot put this into Helper.ts and make it non-export, because we are importing Helper.ts from this file, and the circular import
 * would prevent this class from extending Schema.
 */
export abstract class MutableSchema extends Schema {
  public abstract async createEntityClass(name: string, modifier?: ECClassModifier): Promise<EntityClass>;
  public abstract createEntityClassSync(name: string, modifier?: ECClassModifier): EntityClass;
  public abstract async createMixinClass(name: string): Promise<Mixin>;
  public abstract createMixinClassSync(name: string): Mixin;
  public abstract async createStructClass(name: string, modifier?: ECClassModifier): Promise<StructClass>;
  public abstract createStructClassSync(name: string, modifier?: ECClassModifier): StructClass;
  public abstract async createCustomAttributeClass(name: string, modifier?: ECClassModifier): Promise<CustomAttributeClass>;
  public abstract createCustomAttributeClassSync(name: string, modifier?: ECClassModifier): CustomAttributeClass;
  public abstract async createRelationshipClass(name: string, modifier?: ECClassModifier): Promise<RelationshipClass>;
  public abstract createRelationshipClassSync(name: string, modifier?: ECClassModifier): RelationshipClass;
  public abstract async createEnumeration(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Promise<Enumeration>;
  public abstract createEnumerationSync(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Enumeration;
  public abstract async createKindOfQuantity(name: string): Promise<KindOfQuantity>;
  public abstract createKindOfQuantitySync(name: string): KindOfQuantity;
  public abstract async createUnit(name: string): Promise<Unit>;
  public abstract createUnitSync(name: string): Unit;
  public abstract async createConstant(name: string): Promise<Constant>;
  public abstract createConstantSync(name: string): Constant;
  public abstract async createInvertedUnit(name: string): Promise<InvertedUnit>;
  public abstract createInvertedUnitSync(name: string): InvertedUnit;
  public abstract async createPhenomenon(name: string): Promise<Phenomenon>;
  public abstract createPhenomenonSync(name: string): Phenomenon;
  public abstract async createFormat(name: string): Promise<Format>;
  public abstract createFormatSync(name: string): Format;
  public abstract async createUnitSystem(name: string): Promise<UnitSystem>;
  public abstract createUnitSystemSync(name: string): UnitSystem;
  public abstract async createPropertyCategory(name: string): Promise<PropertyCategory>;
  public abstract createPropertyCategorySync(name: string): PropertyCategory;
  public abstract async addItem<T extends SchemaItem>(item: T): Promise<void>;
  public abstract addItemSync<T extends SchemaItem>(item: T): void;
  public abstract async addReference(refSchema: Schema): Promise<void>;
  public abstract addReferenceSync(refSchema: Schema): void;
}
