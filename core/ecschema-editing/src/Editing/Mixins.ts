/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps, ECObjectsError, ECObjectsStatus, EntityClass, Mixin, MixinProps, NavigationPropertyProps, RelationshipClass,
  SchemaItemKey, SchemaItemType, SchemaKey, StrengthDirection,
} from "@itwin/ecschema-metadata";
import { PropertyEditResults, SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableMixin } from "./Mutable/MutableMixin";
import { MutableEntityClass } from "./Mutable/MutableEntityClass";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type Mixin.
 */
export class Mixins extends ECClasses {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, appliesTo: SchemaItemKey, displayLabel?: string, baseClass?: SchemaItemKey): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    const newClass = ((await schema.createMixinClass(name)) as MutableMixin);
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };

    if (baseClass !== undefined) {
      const baseClassItem = await schema.lookupItem<Mixin>(baseClass);
      if (baseClassItem === undefined)
        return { errorMessage: `Unable to locate base class ${baseClass.fullName} in schema ${schema.fullName}.` };

      if (baseClassItem.schemaItemType !== SchemaItemType.Mixin)
        return { errorMessage: `${baseClassItem.fullName} is not of type Mixin.` };

      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, Mixin>(baseClass, async () => baseClassItem);
    }

    const newAppliesTo = (await this._schemaEditor.schemaContext.getSchemaItem<EntityClass>(appliesTo));
    if (newAppliesTo === undefined || newAppliesTo.schemaItemType !== SchemaItemType.EntityClass)
      return { errorMessage: `Failed to locate the appliedTo entity class ${appliesTo.name}.` };

    newClass.setAppliesTo(new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(newAppliesTo.key, async () => newAppliesTo));

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return { itemKey: newClass.key };
  }

  /**
   * Creates a MixinClass through a MixinProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param mixinProps a json object that will be used to populate the new MixinClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, mixinProps: MixinProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    if (mixinProps.name === undefined)
      return { errorMessage: `No name was supplied within props.` };

    const newClass = (await schema.createMixinClass(mixinProps.name)) as MutableMixin;
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${mixinProps.name} in schema ${schemaKey.toString(true)}.` };

    await newClass.fromJSON(mixinProps);
    return { itemKey: newClass.key };
  }

  public async addMixin(entityKey: SchemaItemKey, mixinKey: SchemaItemKey): Promise<void> {
    const entity = (await this._schemaEditor.schemaContext.getSchemaItem<MutableEntityClass>(entityKey));
    const mixin = (await this._schemaEditor.schemaContext.getSchemaItem<Mixin>(mixinKey));

    if (entity === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Entity Class ${entityKey.fullName} not found in schema context.`);

    if (mixin === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Mixin Class ${mixinKey.fullName} not found in schema context.`);

    if (entity.schemaItemType !== SchemaItemType.EntityClass)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${entityKey.fullName} to be of type Entity Class.`);

    if (mixin.schemaItemType !== SchemaItemType.Mixin)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${mixinKey.fullName} to be of type Mixin.`);

    entity.addMixin(mixin);
  }

  public async createNavigationProperty(mixinKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
    const mixin = (await this._schemaEditor.schemaContext.getSchemaItem<MutableMixin>(mixinKey));

    if (mixin === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Mixin Class ${mixinKey.fullName} not found in schema context.`);

    if (mixin.schemaItemType !== SchemaItemType.Mixin)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${mixinKey.fullName} to be of type Mixin.`);

    await mixin.createNavigationProperty(name, relationship, direction);
    return { itemKey: mixinKey, propertyName: name };
  }

  /**
   * Creates a Navigation Property through a NavigationPropertyProps.
   * @param classKey a SchemaItemKey of the Mixin that will house the new property.
   * @param navigationProps a json object that will be used to populate the new Navigation Property.
   */
  public async createNavigationPropertyFromProps(classKey: SchemaItemKey, navigationProps: NavigationPropertyProps): Promise<PropertyEditResults> {
    const mixin = await this._schemaEditor.schemaContext.getSchemaItem<MutableMixin>(classKey);
    if (mixin === undefined)
      return { itemKey: classKey, propertyName: navigationProps.name, errorMessage: `Mixin ${classKey.fullName} not found in schema context.`};

    if (mixin.schemaItemType !== SchemaItemType.Mixin)
      return { itemKey: classKey, propertyName: navigationProps.name, errorMessage: `Expected ${classKey.fullName} to be of type Mixin.`};

    const navigationProperty  = await mixin.createNavigationProperty(navigationProps.name, navigationProps.relationshipName, navigationProps.direction);
    await navigationProperty.fromJSON(navigationProps);

    return { itemKey: classKey, propertyName: navigationProps.name };
  }

  public async setMixinBaseClass(mixinKey: SchemaItemKey, baseClassKey?: SchemaItemKey): Promise<SchemaItemEditResults>{
    const mixin = (await this._schemaEditor.schemaContext.getSchemaItem<MutableMixin>(mixinKey));

    if (mixin === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Mixin Class ${mixinKey.fullName} not found in schema context.`);

    if (baseClassKey === undefined) {
      mixin.baseClass = undefined;
      return { itemKey: mixinKey };
    }

    const baseClassSchema = !baseClassKey.schemaKey.matches(mixinKey.schemaKey) ? await this._schemaEditor.getSchema(baseClassKey.schemaKey) : mixin.schema;
    if (baseClassSchema === undefined) {
      return { errorMessage: `Schema Key ${baseClassKey.schemaKey.toString(true)} not found in context` };
    }

    const baseClassItem = await baseClassSchema.lookupItem<Mixin>(baseClassKey);
    if (baseClassItem === undefined)
      return { errorMessage: `Unable to locate base class ${baseClassKey.fullName} in schema ${baseClassSchema.fullName}.` };

    if (baseClassItem.schemaItemType !== SchemaItemType.Mixin)
      return { errorMessage: `${baseClassItem.fullName} is not of type Mixin Class.` };

    mixin.baseClass = new DelayedPromiseWithProps<SchemaItemKey, Mixin>(baseClassKey, async () => baseClassItem);
    return { itemKey: mixinKey };
  }
}
