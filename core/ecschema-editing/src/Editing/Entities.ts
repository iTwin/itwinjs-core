/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  ECClassModifier, EntityClass, EntityClassProps,
  Mixin, NavigationPropertyProps, RelationshipClass, SchemaItemKey, SchemaItemType, SchemaKey, StrengthDirection,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableEntityClass } from "./Mutable/MutableEntityClass";
import { NavigationProperties } from "./Properties";
import { ECEditingStatus, SchemaEditingError, schemaItemIdentifier, schemaItemIdentifierFromName } from "./Exception";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type EntityClass.
 */
export class Entities extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.EntityClass, schemaEditor);
  }

  /**
   * Allows access for editing of NavigationProperty attributes.
   */
  public readonly navigationProperties = new NavigationProperties(SchemaItemType.EntityClass, this._schemaEditor);

  public async createElement(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClassKey: SchemaItemKey, displayLabel?: string, mixins?: Mixin[]): Promise<SchemaItemKey> {
    try {
      const baseClass = await this.getSchemaItem(baseClassKey);
      if (!(await (baseClass as EntityClass).is("Element", "BisCore"))) {
        throw new SchemaEditingError(ECEditingStatus.BaseClassIsNotElement, schemaItemIdentifier(this.schemaItemType, baseClassKey));
      }
    } catch(e: any){
      throw new SchemaEditingError(ECEditingStatus.CreateElementFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    return this.create(schemaKey, name, modifier, displayLabel, baseClassKey, mixins);
  }

  public async createElementUniqueAspect(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClassKey: SchemaItemKey, displayLabel?: string, mixins?: Mixin[]): Promise<SchemaItemKey> {
    try {
      const baseClass = await this.getSchemaItem(baseClassKey);
      if (!(await (baseClass as EntityClass).is("ElementUniqueAspect", "BisCore"))) {
        throw new SchemaEditingError(ECEditingStatus.BaseClassIsNotElementUniqueAspect, schemaItemIdentifier(this.schemaItemType, baseClassKey));
      }
    } catch(e: any){
      throw new SchemaEditingError(ECEditingStatus.CreateElementFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    return this.create(schemaKey, name, modifier, displayLabel, baseClassKey, mixins);
  }

  public async createElementMultiAspect(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, baseClassKey: SchemaItemKey, displayLabel?: string, mixins?: Mixin[]): Promise<SchemaItemKey> {
    try {
      const baseClass = await this.getSchemaItem(baseClassKey);
      if (!(await (baseClass as EntityClass).is("ElementMultiAspect", "BisCore"))) {
        throw new SchemaEditingError(ECEditingStatus.BaseClassIsNotElementMultiAspect, schemaItemIdentifier(this.schemaItemType, baseClassKey));
      }
    } catch(e: any){
      throw new SchemaEditingError(ECEditingStatus.CreateElementFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    return this.create(schemaKey, name, modifier, displayLabel, baseClassKey, mixins);
  }

  public async create(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, displayLabel?: string, baseClassKey?: SchemaItemKey, mixins?: Mixin[]): Promise<SchemaItemKey> {
    let newClass: MutableEntityClass;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createEntityClass.bind(schema);
      newClass = (await this.createClass<EntityClass>(schemaKey, this.schemaItemType, boundCreate, name, baseClassKey, modifier)) as MutableEntityClass;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    if (mixins !== undefined)
      mixins.forEach((m) => newClass.addMixin(m));

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return newClass.key;
  }

  /**
   * Creates an EntityClass through an EntityClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param entityProps a json object that will be used to populate the new EntityClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, entityProps: EntityClassProps): Promise<SchemaItemKey> {
    let newClass: MutableEntityClass;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createEntityClass.bind(schema);
      newClass = (await this.createSchemaItemFromProps<EntityClass>(schemaKey, this.schemaItemType, boundCreate, entityProps)) as MutableEntityClass;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromPropsFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, entityProps.name!), e);
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

  public async createNavigationProperty(entityKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<void> {
    try {
      const entity = await this.getSchemaItem<MutableEntityClass>(entityKey);
      await entity.createNavigationProperty(name, relationship, direction);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateNavigationPropertyFailed, schemaItemIdentifier(SchemaItemType.RelationshipClass, entityKey), e);
    }
  }

  /**
   * Creates a Navigation Property through a NavigationPropertyProps.
   * @param classKey a SchemaItemKey of the Entity Class that will house the new property.
   * @param navigationProps a json object that will be used to populate the new Navigation Property.
   */
  public async createNavigationPropertyFromProps(classKey: SchemaItemKey, navigationProps: NavigationPropertyProps): Promise<void> {
    try {
      const entity = await this.getSchemaItem<MutableEntityClass>(classKey);
      const property = await entity.createNavigationProperty(navigationProps.name, navigationProps.relationshipName, navigationProps.direction);
      await property.fromJSON(navigationProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateNavigationPropertyFromPropsFailed, schemaItemIdentifier(SchemaItemType.EntityClass, classKey), e);
    }
  }
}
