/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECClass, MutableClass, StructClass } from "../Metadata/Class";
import { MutableSchema, Schema } from "../Metadata/Schema";
import { EntityClass, MutableEntityClass } from "../Metadata/EntityClass";
import { CustomAttributeContainerType, ECClassModifier, PrimitiveType, SchemaItemType, SchemaMatchType, StrengthDirection } from "../ECObjects";
import { CustomAttributeClass, MutableCAClass } from "../Metadata/CustomAttributeClass";
import { MutableRelationshipClass, RelationshipClass } from "../Metadata/RelationshipClass";
import { AnyEnumerator, Enumeration, MutableEnumeration } from "../Metadata/Enumeration";
import { Unit } from "../Metadata/Unit";
import { MutableConstant } from "../Metadata/Constant";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { Phenomenon } from "../Metadata/Phenomenon";
import { MutableFormat } from "../Metadata/Format";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaContext } from "../Context";
import { Mixin, MutableMixin } from "../Metadata/Mixin";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import { ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, FormatProps, MixinProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, RelationshipClassProps, StructArrayPropertyProps, StructClassProps, StructPropertyProps } from "../Deserialization/JsonProps";
import { FormatType } from "../utils/FormatEnums";

// We can either add validation in Editor, or in the protected methods of Schema.

// TODO: Add an error code so we can do something programmatic with the error.
/**
 * @alpha
 */
export interface SchemaEditResults {
  schemaKey?: SchemaKey;
  errorMessage?: string;
}

/**
 * @alpha
 */
export interface SchemaItemEditResults {
  itemKey?: SchemaItemKey;
  errorMessage?: string;
}

/**
 * @alpha
 */
export interface PropertyEditResults {
  itemKey?: SchemaItemKey;
  propertyName?: string;
  errorMessage?: string;
}

/**
 * A class that allows you to edit and create schemas, classes, and items from the SchemaContext level.
 * @alpha
 */
export class SchemaContextEditor {
  private _schemaContext: SchemaContext;
  public readonly entities = new Editors.Entities(this);
  public readonly mixins = new Editors.Mixins(this);
  public readonly structs = new Editors.Structs(this);
  public readonly customAttributes = new Editors.CustomAttributes(this);
  public readonly relationships = new Editors.RelationshipClasses(this);
  public readonly constants = new Editors.Constants(this);
  public readonly enumerations = new Editors.Enumerations(this);
  public readonly formats = new Editors.Formats(this);

  /**
   *
   * @param schemaContext The SchemaContext the Editor will use to edit in.
   */
  constructor(schemaContext: SchemaContext) {
    // TODO: Make copy
    this._schemaContext = schemaContext;
  }

  public async finish(): Promise<SchemaContext> {
    return this._schemaContext;
  }

  public async createSchema(name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number): Promise<SchemaEditResults> {
    const newSchema = new Schema(this._schemaContext, name, alias, readVersion, writeVersion, minorVersion);
    await this._schemaContext.addSchema(newSchema);
    return { schemaKey: newSchema.schemaKey };
  }

  /**
   * Allows you to get schema classes and items through regular SchemaContext methods.
   */
  public get schemaContext(): SchemaContext { return this._schemaContext; }

}

/**
 * @alpha
 */
export namespace Editors {

  /**
   * @alpha
   * Acts as a base class for schema class creation. Enables property creation.
   */
  export class ECClasses {
    protected constructor(protected _schemaEditor: SchemaContextEditor) { }

    public async createPrimitiveProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };

      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      await mutableClass.createPrimitiveProperty(name, type);

      return { itemKey: classKey, propertyName: name };
    }

    public async createPrimitivePropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitivePropertyProps): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };

      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      const newProperty = await mutableClass.createPrimitiveProperty(name, type);
      await newProperty.fromJSON(primitiveProps);
      return { itemKey: classKey, propertyName: name };
    }

    public async createEnumerationProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };

      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const enumSchemaItemKey = ecClass.schema.getSchemaItemKey(type.fullName);
      if (enumSchemaItemKey === undefined) throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the enumeration ${type.fullName}.`);

      const mutableClass = ecClass as MutableClass;
      await mutableClass.createPrimitiveProperty(name, type);

      return { itemKey: classKey, propertyName: name };
    }
    public async createEnumerationPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, enumProps: EnumerationPropertyProps): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };

      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      const newProperty = await mutableClass.createPrimitiveProperty(name, type);
      await newProperty.fromJSON(enumProps);
      return { itemKey: classKey, propertyName: name };
    }
    public async createPrimitiveArrayProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      await mutableClass.createPrimitiveArrayProperty(name, type);
      return { itemKey: classKey, propertyName: name };
    }

    public async createPrimitiveArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitiveArrayPropertyProps): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
      await newProperty.fromJSON(primitiveProps);
      return { itemKey: classKey, propertyName: name };
    }

    public async createStructProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      await mutableClass.createStructProperty(name, type);
      return { itemKey: classKey, propertyName: name };
    }

    public async createStructPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructPropertyProps): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      const newProperty = await mutableClass.createStructProperty(name, type);
      await newProperty.fromJSON(structProps);
      return { itemKey: classKey, propertyName: name };
    }

    public async createStructArrayProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      await mutableClass.createStructArrayProperty(name, type);
      return { itemKey: classKey, propertyName: name };
    }

    public async createStructArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructArrayPropertyProps): Promise<PropertyEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(classKey.schemaKey, SchemaMatchType.Latest));
      if (schema === undefined) return { errorMessage: `Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found` };
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined) return { errorMessage: `Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}` };

      switch (ecClass.schemaItemType) {
        case SchemaItemType.EntityClass:
        case SchemaItemType.Mixin:
        case SchemaItemType.StructClass:
        case SchemaItemType.CustomAttributeClass:
        case SchemaItemType.RelationshipClass:
          break;
        default:
          return { errorMessage: `Schema item type not supported` };
      }

      const mutableClass = ecClass as MutableClass;
      const newProperty = await mutableClass.createStructArrayProperty(name, type);
      await newProperty.fromJSON(structProps);
      return { itemKey: classKey, propertyName: name };
    }

  }

  /**
   * @alpha
   * A class extending ECClasses allowing you to create schema items of type EntityClass.
   */
  export class Entities extends ECClasses {
    public constructor(_schemaEditor: SchemaContextEditor) {
      super(_schemaEditor);
    }
    public async create(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClass?: SchemaItemKey, mixins?: Mixin[]): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      const newClass = (await schema.createEntityClass(name, modifier)) as MutableEntityClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      // Add a deserializing method.
      if (baseClass !== undefined) {
        const baseClassItem = await schema.lookupItem(baseClass) as EntityClass;
        newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
      }

      if (mixins !== undefined) {
        mixins.forEach((m) => newClass.addMixin(m));
      }

      return { itemKey: newClass.key };
    }

    /**
     * Creates an EntityClass through an EntityClassProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param entityProps a json object that will be used to populate the new EntityClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, entityProps: EntityClassProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (entityProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createEntityClass(entityProps.name)) as MutableEntityClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(entityProps);

      return { itemKey: newClass.key };
    }
    public async addMixin(entityKey: SchemaItemKey, mixinKey: SchemaItemKey): Promise<void> {
      const entity = (await this._schemaEditor.schemaContext.getSchemaItem(entityKey)) as MutableEntityClass;
      const mixin = (await this._schemaEditor.schemaContext.getSchemaItem(mixinKey)) as Mixin;

      // TODO: have a helpful returns
      if (entity === undefined) return;
      if (mixin === undefined) return;
      if (entity.schemaItemType !== SchemaItemType.EntityClass) return;
      if (mixin.schemaItemType !== SchemaItemType.Mixin) return;

      entity.addMixin(mixin);
    }

    public async createNavigationProperty(entityKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
      const entity = (await this._schemaEditor.schemaContext.getSchemaItem(entityKey)) as MutableEntityClass;

      if (entity === undefined) throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Entity Class ${entityKey.fullName} not found in schema context.`);
      if (entity.schemaItemType !== SchemaItemType.EntityClass) throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${entityKey.fullName} to be of type Entity Class.`);

      await entity.createNavigationProperty(name, relationship, direction);
      return { itemKey: entityKey, propertyName: name };
    }
  }
  /**
   * @alpha
   * A class extending ECClasses allowing you to create schema items of type Mixin.
   */
  export class Mixins extends ECClasses {
    public constructor(_schemaEditor: SchemaContextEditor) {
      super(_schemaEditor);
    }

    public async create(schemaKey: SchemaKey, name: string, appliesTo: SchemaItemKey, baseClass?: SchemaItemKey): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      const newClass = (await schema.createMixinClass(name)) as MutableMixin;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      if (baseClass !== undefined) {
        const baseClassItem = await schema.lookupItem(baseClass) as Mixin;
        newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
      }

      const newAppliesTo = (await this._schemaEditor.schemaContext.getSchemaItem(appliesTo)) as EntityClass;
      // Check if entity class's enum (0) will cause this to return false, maybe check undefined and SchemaItemType separately?
      if (newAppliesTo === undefined || newAppliesTo.schemaItemType !== SchemaItemType.EntityClass) { return { errorMessage: `Failed to locate the appliedTo entity class ${appliesTo.name}.` }; }
      newClass.setAppliesTo(new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(newAppliesTo.key, async () => newAppliesTo));

      return { itemKey: newClass.key };
    }

    /**
     * Creates a MixinClass through a MixinProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param mixinProps a json object that will be used to populate the new MixinClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, mixinProps: MixinProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (mixinProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createMixinClass(mixinProps.name)) as MutableMixin;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(mixinProps);

      return { itemKey: newClass.key };
    }

    public async addMixin(entityKey: SchemaItemKey, mixinKey: SchemaItemKey): Promise<void> {
      const entity = (await this._schemaEditor.schemaContext.getSchemaItem(entityKey)) as MutableEntityClass;
      const mixin = (await this._schemaEditor.schemaContext.getSchemaItem(mixinKey)) as Mixin;

      if (entity === undefined) throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Entity Class ${entityKey.fullName} not found in schema context.`);
      if (mixin === undefined) throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Mixin Class ${mixinKey.fullName} not found in schema context.`);
      if (entity.schemaItemType !== SchemaItemType.EntityClass) throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${entityKey.fullName} to be of type Entity Class.`);
      if (mixin.schemaItemType !== SchemaItemType.Mixin) throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${mixinKey.fullName} to be of type Mixin.`);

      entity.addMixin(mixin);
    }

    public async createNavigationProperty(mixinKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
      const mixin = (await this._schemaEditor.schemaContext.getSchemaItem(mixinKey)) as MutableMixin;

      if (mixin === undefined) throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Mixin Class ${mixinKey.fullName} not found in schema context.`);
      if (mixin.schemaItemType !== SchemaItemType.Mixin) throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${mixinKey.fullName} to be of type Mixin.`);

      await mixin.createNavigationProperty(name, relationship, direction);
      return { itemKey: mixinKey, propertyName: name };
    }
  }
  /**
   * @alpha A class extending ECClasses allowing you to create schema items of type StructClass.
   */
  export class Structs extends ECClasses {
    public constructor(_schemaEditor: SchemaContextEditor) {
      super(_schemaEditor);
    }

    public async create(schemaKey: SchemaKey, name: string, baseClass?: SchemaItemKey): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      const newClass = (await schema.createStructClass(name)) as MutableClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      if (baseClass !== undefined) {
        const baseClassItem = await schema.lookupItem(baseClass) as StructClass;
        newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
      }

      return { itemKey: newClass.key };
    }

    /**
     *  Creates a StructClass through a StructClassProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param structProps a json object that will be used to populate the new StructClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, structProps: StructClassProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (structProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createStructClass(structProps.name)) as MutableClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(structProps);

      return { itemKey: newClass.key };
    }
  }
  /**
   * @alpha
   * A class extending ECClasses allowing you to create schema items of type CustomAttributeClass.
   */
  export class CustomAttributes extends ECClasses {
    public constructor(_schemaEditor: SchemaContextEditor) {
      super(_schemaEditor);
    }

    public async create(schemaKey: SchemaKey, name: string, containerType: CustomAttributeContainerType, baseClass?: SchemaItemKey): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      const newClass = (await schema.createCustomAttributeClass(name)) as MutableCAClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      if (baseClass !== undefined) {
        const baseClassItem = await schema.lookupItem(baseClass) as CustomAttributeClass;
        newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
      }

      newClass.setContainerType(containerType);

      return { itemKey: newClass.key };
    }

    /**
     * Creates a CustomAttributeClass through a CustomAttributeClassProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param caProps a json object that will be used to populate the new CustomAttributeClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, caProps: CustomAttributeClassProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (caProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createCustomAttributeClass(caProps.name)) as MutableCAClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }
      await newClass.fromJSON(caProps);

      return { itemKey: newClass.key };
    }
  }
  /**
   * @alpha
   * A class extending ECClasses allowing you to create schema items of type RelationshipClass.
   * Can only create RelationshipClass objects using RelationshipClassProps for now.
   */
  export class RelationshipClasses extends ECClasses {
    public constructor(_schemaEditor: SchemaContextEditor) {
      super(_schemaEditor);
    }

    // // TODO: Add relationshipConstraint, multiplicity arguments.
    // // Note: This method is not done yet, there's a lot of arguments.
    // public async create(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, strength: StrengthType, direction: StrengthDirection, sourceMultiplicity: RelationshipMultiplicity, targetMultiplicity: RelationshipMultiplicity, baseClass?: SchemaItemKey) {
    //   const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
    //   if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    //   const newClass = (await schema.createRelationshipClass(name, modifier)) as MutableRelationshipClass;
    //   if (newClass === undefined) {
    //     return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
    //   }

    //   if (baseClass !== undefined) {
    //     const baseClassItem = await schema.lookupItem(baseClass) as RelationshipClass;
    //     newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
    //   }
    //   newClass.setStrength(strength);
    //   newClass.setStrengthDirection(direction);

    //   return { itemKey: newClass.key };
    // }

    /**
     * Creates a RelationshipClass through a RelationshipClassProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, relationshipProps: RelationshipClassProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (relationshipProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createRelationshipClass(relationshipProps.name)) as MutableRelationshipClass;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(relationshipProps);
      await newClass.source.fromJSON(relationshipProps.source);
      await newClass.target.fromJSON(relationshipProps.target);

      return { itemKey: newClass.key };
    }

    public async createNavigationProperty(relationshipKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
      const relationshipClass = (await this._schemaEditor.schemaContext.getSchemaItem(relationshipKey)) as MutableRelationshipClass;

      if (relationshipClass === undefined) throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Relationship Class ${relationshipKey.fullName} not found in schema context.`);
      if (relationshipClass.schemaItemType !== SchemaItemType.RelationshipClass) throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${relationshipKey.fullName} to be of type Relationship Class.`);

      await relationshipClass.createNavigationProperty(name, relationship, direction);
      return { itemKey: relationshipKey, propertyName: name };
    }
  }

  /**
   * @alpha
   * A class allowing you to create schema items of type Constant.
   */
  export class Constants {
    public constructor(protected _schemaEditor: SchemaContextEditor) { }

    public async create(schemaKey: SchemaKey, name: string, phenomenon: SchemaItemKey, definition: string, numerator?: number, denominator?: number): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Exact)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      const newClass = (await schema.createConstant(name)) as MutableConstant;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      const newPhenomenon = (await this._schemaEditor.schemaContext.getSchemaItem(phenomenon)) as Phenomenon;
      if (newPhenomenon === undefined || newPhenomenon.schemaItemType !== SchemaItemType.Phenomenon) {
        return { errorMessage: `Unable to locate phenomenon ${phenomenon.name}` };
      }
      newClass.setPhenomenon(new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(newPhenomenon.key, async () => newPhenomenon));
      newClass.setDefinition(definition);

      if (numerator) { newClass.setNumerator(numerator); }
      if (denominator) { newClass.setDenominator(denominator); }

      return { itemKey: newClass.key };
    }

    /**
     * Creates a Constant through a ConstantProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, constantProps: ConstantProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (constantProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createConstant(constantProps.name)) as MutableConstant;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(constantProps);
      return { itemKey: newClass.key };
    }
  }
  /**
   * @alpha
   * A class extending ECClasses allowing you to create schema items of type Enumeration.
   */
  export class Enumerations {
    public constructor(protected _schemaEditor: SchemaContextEditor) { }

    public async create(schemaKey: SchemaKey, name: string, type: PrimitiveType.Integer | PrimitiveType.String, isStrict?: boolean, enumerators?: AnyEnumerator[]): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Exact)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      const newClass = (await schema.createEnumeration(name, type)) as MutableEnumeration;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      if (undefined !== isStrict) {
        newClass.setIsStrict(isStrict);
      }
      if (undefined !== enumerators) {
        for (const enumerator of enumerators) {
          await this.addEnumerator(newClass.key, enumerator);
        }
      }

      return { itemKey: newClass.key };
    }

    /**
     * Creates an Enumeration through an EnumeratorProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, enumProps: EnumerationProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (enumProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createEnumeration(enumProps.name)) as MutableEnumeration;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(enumProps);
      return { itemKey: newClass.key };
    }
    public async addEnumerator(enumerationKey: SchemaItemKey, enumerator: AnyEnumerator): Promise<void> {
      const enumeration = (await this._schemaEditor.schemaContext.getSchemaItem(enumerationKey)) as MutableEnumeration;

      if (enumeration.isInt && typeof (enumerator.value) === "string") {
        throw new ECObjectsError(ECObjectsStatus.InvalidPrimitiveType, `The Enumeration ${enumeration.name} has type integer, while ${enumerator.name} has type string.`);
      }

      if (!enumeration.isInt && typeof (enumerator.value) === "number") {
        throw new ECObjectsError(ECObjectsStatus.InvalidPrimitiveType, `The Enumeration ${enumeration.name} has type string, while ${enumerator.name} has type integer.`);
      }

      enumeration.addEnumerator(enumerator);
    }
  }
  /**
   * @alpha
   * A class extending ECClasses allowing you to create schema items of type Format.
   */
  export class Formats {
    public constructor(protected _schemaEditor: SchemaContextEditor) { }
    public async create(schemaKey: SchemaKey, name: string, formatType: FormatType, units?: SchemaItemKey[]): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      const newClass = (await schema.createFormat(name)) as MutableFormat;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      if (units !== undefined) {
        for (const unit of units) {
          const unitItem = await this._schemaEditor.schemaContext.getSchemaItem<Unit | InvertedUnit>(unit);
          if (unitItem === undefined) {
            return { errorMessage: `Failed to locate unit ${unit.name} in Schema Context.` };
          }
          newClass.addUnit(unitItem);
        }
      }
      // TODO: Handle the setting of format traits, separators, etc....
      newClass.setFormatType(formatType);
      return { itemKey: newClass.key };
    }

    /**
     * Creates a format through a FormatProps.
     * @param schemaKey a SchemaKey of the Schema that will house the new object.
     * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
     */
    public async createFromProps(schemaKey: SchemaKey, formatProps: FormatProps): Promise<SchemaItemEditResults> {
      const schema = (await this._schemaEditor.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest)) as MutableSchema;
      if (schema === undefined) return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

      if (formatProps.name === undefined) return { errorMessage: `No name was supplied within props.` };
      const newClass = (await schema.createFormat(formatProps.name)) as MutableFormat;
      if (newClass === undefined) {
        return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
      }

      await newClass.fromJSON(formatProps);
      return { itemKey: newClass.key };
    }
  }
}
