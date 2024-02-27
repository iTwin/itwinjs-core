/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps, ECClassModifier, ECObjectsError, ECObjectsStatus, EntityClass, EntityClassProps,
  Mixin, NavigationPropertyProps, RelationshipClass, SchemaItemKey, SchemaItemType, SchemaKey, StrengthDirection,
} from "@itwin/ecschema-metadata";
import { PropertyEditResults, SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableEntityClass } from "./Mutable/MutableEntityClass";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type EntityClass.
 */
export class Entities extends ECClasses {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }

  public async createElement(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClassKey: SchemaItemKey, displayLabel?: string, mixins?: Mixin[]): Promise<SchemaItemEditResults> {
    const baseClass = await this._schemaEditor.schemaContext.getSchemaItem(baseClassKey);
    if (!baseClass)
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} could not be found.`);

    if (baseClass?.schemaItemType !== SchemaItemType.EntityClass)
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} is not an EntityClass.`);

    if (!(await (baseClass as EntityClass).is("Element", "BisCore"))) {
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} is not an Element.`);
    }

    return this.create(schemaKey, name, modifier, displayLabel, baseClassKey, mixins);
  }

  public async createElementUniqueAspect(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClassKey: SchemaItemKey, displayLabel?: string, mixins?: Mixin[]): Promise<SchemaItemEditResults> {
    const baseClass = await this._schemaEditor.schemaContext.getSchemaItem(baseClassKey);
    if (!baseClass)
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} could not be found.`);

    if (baseClass?.schemaItemType !== SchemaItemType.EntityClass)
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} is not an EntityClass.`);

    if (!(await (baseClass as EntityClass).is("ElementUniqueAspect", "BisCore"))) {
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} is not an ElementUniqueAspect.`);
    }

    return this.create(schemaKey, name, modifier, displayLabel, baseClassKey, mixins);
  }

  public async createElementMultiAspect(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClassKey: SchemaItemKey, displayLabel?: string, mixins?: Mixin[]): Promise<SchemaItemEditResults> {
    const baseClass = await this._schemaEditor.schemaContext.getSchemaItem(baseClassKey);
    if (!baseClass)
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} could be found.`);

    if (baseClass?.schemaItemType !== SchemaItemType.EntityClass)
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} is not an EntityClass.`);

    if (!(await (baseClass as EntityClass).is("ElementMultiAspect", "BisCore"))) {
      throw new Error(`The class ${name} could not be created because the specified base class ${baseClassKey.fullName} is not an ElementMultiAspect.`);
    }

    return this.create(schemaKey, name, modifier, displayLabel, baseClassKey, mixins);
  }

  public async create(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, displayLabel?: string, baseClassKey?: SchemaItemKey, mixins?: Mixin[]): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    const newClass = (await schema.createEntityClass(name, modifier)) as MutableEntityClass;
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };

    // Add a deserializing method.
    if (baseClassKey !== undefined) {
      const baseClassSchema = !baseClassKey.schemaKey.matches(schema.schemaKey) ? await this._schemaEditor.getSchema(baseClassKey.schemaKey) : schema;
      if (baseClassSchema === undefined) {
        return { errorMessage: `Schema Key ${baseClassKey.schemaKey.toString(true)} not found in context` };
      }

      const baseClassItem = await baseClassSchema.lookupItem<EntityClass>(baseClassKey);
      if (baseClassItem === undefined)
        return { errorMessage: `Unable to locate base class ${baseClassKey.fullName} in schema ${baseClassSchema.fullName}.` };

      if (baseClassItem.schemaItemType !== SchemaItemType.EntityClass)
        return { errorMessage: `${baseClassItem.fullName} is not of type Entity Class.` };

      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(baseClassKey, async () => baseClassItem);
    }

    if (mixins !== undefined)
      mixins.forEach((m) => newClass.addMixin(m));

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return { itemKey: newClass.key };
  }

  /**
   * Creates an EntityClass through an EntityClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param entityProps a json object that will be used to populate the new EntityClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, entityProps: EntityClassProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    if (entityProps.name === undefined)
      return { errorMessage: `No name was supplied within props.` };

    const newClass = (await schema.createEntityClass(entityProps.name)) as MutableEntityClass;
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${entityProps.name} in schema ${schemaKey.toString(true)}.` };

    await newClass.fromJSON(entityProps);

    return { itemKey: newClass.key };
  }

  public async addMixin(entityKey: SchemaItemKey, mixinKey: SchemaItemKey): Promise<SchemaItemEditResults> {
    const entity = (await this._schemaEditor.schemaContext.getSchemaItem<MutableEntityClass>(entityKey));
    if (entity === undefined) {
      return { errorMessage: `Entity Class ${entityKey.fullName} not found in schema context.` };
    }
    if (entity.schemaItemType !== SchemaItemType.EntityClass) {
      return { errorMessage: `Expected ${entityKey.fullName} to be of type Entity Class.` };
    }

    const mixin = (await this._schemaEditor.schemaContext.getSchemaItem<Mixin>(mixinKey));
    if (mixin === undefined) {
      return { errorMessage: `Mixin Class ${mixinKey.fullName} not found in schema context.` };
    }
    if (mixin.schemaItemType !== SchemaItemType.Mixin) {
      return { errorMessage: `Expected ${mixinKey.fullName} to be of type Mixin.`};
    }

    entity.addMixin(mixin);
    return { itemKey: entityKey };
  }

  public async createNavigationProperty(entityKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
    const entity = await this._schemaEditor.schemaContext.getSchemaItem<MutableEntityClass>(entityKey);

    if (entity === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Entity Class ${entityKey.fullName} not found in schema context.`);

    if (entity.schemaItemType !== SchemaItemType.EntityClass)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${entityKey.fullName} to be of type Entity Class.`);

    await entity.createNavigationProperty(name, relationship, direction);
    return { itemKey: entityKey, propertyName: name };
  }

  /**
   * Creates a Navigation Property through a NavigationPropertyProps.
   * @param classKey a SchemaItemKey of the Entity Class that will house the new property.
   * @param navigationProps a json object that will be used to populate the new Navigation Property.
   */
  public async createNavigationPropertyFromProps(classKey: SchemaItemKey, navigationProps: NavigationPropertyProps): Promise<PropertyEditResults> {
    const entity = await this._schemaEditor.schemaContext.getSchemaItem<MutableEntityClass>(classKey);
    if (entity === undefined)
      return { itemKey: classKey, propertyName: navigationProps.name, errorMessage: `Entity Class ${classKey.fullName} not found in schema context.`};

    if (entity.schemaItemType !== SchemaItemType.EntityClass)
      return { itemKey: classKey, propertyName: navigationProps.name, errorMessage: `Expected ${classKey.fullName} to be of type EntityClass.` };

    const navigationProperty  = await entity.createNavigationProperty(navigationProps.name, navigationProps.relationshipName, navigationProps.direction);
    await navigationProperty.fromJSON(navigationProps);

    return { itemKey: classKey, propertyName: navigationProps.name };
  }

  /**
   * Sets the base class of an Entity.
   * @param entityKey The SchemaItemKey of the Entity.
   * @param baseClassKey The SchemaItemKey of the base class. Specifying 'undefined' removes the base class.
   */
  public async setBaseClass(entityKey: SchemaItemKey, baseClassKey?: SchemaItemKey): Promise<SchemaItemEditResults> {
    const entity = (await this._schemaEditor.schemaContext.getSchemaItem<MutableEntityClass>(entityKey));

    if (entity === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Entity Class ${entityKey.fullName} not found in schema context.`);

    if (baseClassKey === undefined) {
      entity.baseClass = undefined;
      return { itemKey: entityKey };
    }

    const baseClassSchema = !baseClassKey.schemaKey.matches(entityKey.schemaKey) ? await this._schemaEditor.getSchema(baseClassKey.schemaKey) : entity.schema;
    if (baseClassSchema === undefined) {
      return { errorMessage: `Schema Key ${baseClassKey.schemaKey.toString(true)} not found in context` };
    }

    const baseClassItem = await baseClassSchema.lookupItem<EntityClass>(baseClassKey);
    if (baseClassItem === undefined)
      return { errorMessage: `Unable to locate base class ${baseClassKey.fullName} in schema ${baseClassSchema.fullName}.` };

    if (baseClassItem.schemaItemType !== SchemaItemType.EntityClass)
      return { errorMessage: `${baseClassItem.fullName} is not of type Entity Class.` };

    entity.baseClass = new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(baseClassKey, async () => baseClassItem);
    return { itemKey: entityKey };
  }
}

