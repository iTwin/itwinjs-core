/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps, EntityClass, Mixin, MixinProps, NavigationPropertyProps, RelationshipClass,
  SchemaItemKey, SchemaItemType, SchemaKey, StrengthDirection,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableMixin } from "./Mutable/MutableMixin";
import { MutableEntityClass } from "./Mutable/MutableEntityClass";
import { NavigationProperties } from "./Properties";
import { ECEditingStatus, SchemaEditingError, schemaItemIdentifier, schemaItemIdentifierFromName } from "./Exception";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type Mixin.
 */
export class Mixins extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.Mixin, schemaEditor);
  }

  /**
   * Allows access for editing of NavigationProperty attributes.
   */
  public readonly navigationProperties = new NavigationProperties(SchemaItemType.Mixin, this._schemaEditor);

  public async create(schemaKey: SchemaKey, name: string, appliesTo: SchemaItemKey, displayLabel?: string, baseClassKey?: SchemaItemKey): Promise<SchemaItemKey> {
    let newClass: MutableMixin;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createMixinClass.bind(schema);
      newClass = (await this.createClass<Mixin>(schemaKey, this.schemaItemType, boundCreate, name, baseClassKey)) as MutableMixin;
      const newAppliesTo = await this.getSchemaItem<EntityClass>(appliesTo, SchemaItemType.EntityClass);
      newClass.setAppliesTo(new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(newAppliesTo.key, async () => newAppliesTo));

    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return newClass.key;
  }

  /**
   * Creates a MixinClass through a MixinProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param mixinProps a json object that will be used to populate the new MixinClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, mixinProps: MixinProps): Promise<SchemaItemKey> {
    let newClass: MutableMixin;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createMixinClass.bind(schema);
      newClass = (await this.createSchemaItemFromProps<Mixin>(schemaKey, this.schemaItemType, boundCreate, mixinProps)) as MutableMixin;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromPropsFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, mixinProps.name!), e);
    }

    return newClass.key;
  }

  public async addMixin(entityKey: SchemaItemKey, mixinKey: SchemaItemKey): Promise<void> {
    try {
      const entity = await this.getSchemaItem<MutableEntityClass>(entityKey, SchemaItemType.EntityClass);
      const mixin = await this.getSchemaItem<Mixin>(mixinKey);
      entity.addMixin(mixin);
    } catch(e: any){
      throw new SchemaEditingError(ECEditingStatus.AddMixinFailed, schemaItemIdentifier(SchemaItemType.EntityClass, entityKey), e);
    }
  }

  public async createNavigationProperty(mixinKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<void> {
    try {
      const mixin = await this.getSchemaItem<MutableMixin>(mixinKey);
      await mixin.createNavigationProperty(name, relationship, direction);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateNavigationPropertyFailed, schemaItemIdentifier(SchemaItemType.Mixin, mixinKey), e);
    }
  }

  /**
   * Creates a Navigation Property through a NavigationPropertyProps.
   * @param classKey a SchemaItemKey of the Mixin that will house the new property.
   * @param navigationProps a json object that will be used to populate the new Navigation Property.
   */
  public async createNavigationPropertyFromProps(classKey: SchemaItemKey, navigationProps: NavigationPropertyProps): Promise<void> {
    try {
      const mixin = await this.getSchemaItem<MutableMixin>(classKey);
      const property = await mixin.createNavigationProperty(navigationProps.name, navigationProps.relationshipName, navigationProps.direction);
      await property.fromJSON(navigationProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateNavigationPropertyFromPropsFailed, schemaItemIdentifier(SchemaItemType.RelationshipClass, classKey), e);
    }
  }
}
