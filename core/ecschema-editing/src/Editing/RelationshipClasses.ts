/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  CustomAttribute, DelayedPromiseWithProps, ECClassModifier, EntityClass, LazyLoadedRelationshipConstraintClass, Mixin, NavigationPropertyProps,
  RelationshipClass, RelationshipClassProps, RelationshipConstraint, RelationshipEnd, RelationshipMultiplicity, SchemaItemKey, SchemaItemType,
  SchemaKey, StrengthDirection, StrengthType,
} from "@itwin/ecschema-metadata";
import { PropertyEditResults, SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableRelationshipClass, MutableRelationshipConstraint } from "./Mutable/MutableRelationshipClass";
import * as Rules from "../Validation/ECRules";
import { RelationshipConstraintDiagnostic, SchemaItemDiagnostic } from "../Validation/Diagnostic";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type RelationshipClass.
 */
export class RelationshipClasses extends ECClasses {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }

  /**
   * Creates a RelationshipClass.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param name The name of the new class.
   * @param modifier The ECClassModifier of the new class.
   * @param strength The relationship StrengthType of the class.
   * @param StrengthDirection The relationship StrengthDirection of the class.
   * @param baseClassKey An optional SchemaItemKey that specifies the base relationship class.
   */
  public async create(schemaKey: SchemaKey, name: string, modifier: ECClassModifier, strength: StrengthType, direction: StrengthDirection, baseClassKey?: SchemaItemKey): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined) {
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };
    }

    const newClass = (await schema.createRelationshipClass(name, modifier)) as MutableRelationshipClass;
    if (baseClassKey !== undefined) {
      const baseClassSchema = !baseClassKey.schemaKey.matches(schema.schemaKey) ? await this._schemaEditor.getSchema(baseClassKey.schemaKey) : schema;
      if (baseClassSchema === undefined) {
        return { errorMessage: `Schema Key ${baseClassKey.schemaKey.toString(true)} not found in context` };
      }

      const baseClassItem = await baseClassSchema.lookupItem<RelationshipClass>(baseClassKey);
      if (baseClassItem === undefined)
        return { errorMessage: `Unable to locate base class ${baseClassKey.fullName} in schema ${baseClassSchema.fullName}.` };

      if (baseClassItem.schemaItemType !== SchemaItemType.RelationshipClass)
        return { errorMessage: `${baseClassItem.fullName} is not of type Relationship Class.` };

      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, RelationshipClass>(baseClassKey, async () => baseClassItem);
    }

    newClass.setStrength(strength);
    newClass.setStrengthDirection(direction);

    return { itemKey: newClass.key };
  }

  /**
   * Sets the source RelationshipConstraint on the relationship.
   * @param relationshipKey The SchemaItemKey for the relationship.
   * @param source The RelationshipConstraint to add.
   * @returns A promise of type SchemaItemEditResults.
   */
  public async setSourceConstraint(relationshipKey: SchemaItemKey, source: RelationshipConstraint): Promise<SchemaItemEditResults> {
    const relationship = (await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey));

    if (relationship === undefined)
      return { itemKey: relationshipKey, errorMessage: `Relationship Class ${relationshipKey.fullName} not found in schema context.` };

    relationship.setSourceConstraint(source);
    return { itemKey: relationshipKey };
  }

  /**
   * Sets the target RelationshipConstraint on the relationship.
   * @param relationshipKey The SchemaItemKey for the relationship.
   * @param target The RelationshipConstraint to add.
   * @returns A promise of type SchemaItemEditResults.
   */
  public async setTargetConstraint(relationshipKey: SchemaItemKey, target: RelationshipConstraint): Promise<SchemaItemEditResults> {
    const relationship = (await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey));

    if (relationship === undefined)
      return { itemKey: relationshipKey, errorMessage: `Relationship Class ${relationshipKey.fullName} not found in schema context.` };

    relationship.setTargetConstraint(target);
    return { itemKey: relationshipKey };
  }

  /**
   * Creates a RelationshipClass through a RelationshipClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, relationshipProps: RelationshipClassProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    if (relationshipProps.name === undefined)
      return { errorMessage: `No name was supplied within props.` };

    const newClass = (await schema.createRelationshipClass(relationshipProps.name)) as MutableRelationshipClass;
    await newClass.fromJSON(relationshipProps);
    await newClass.source.fromJSON(relationshipProps.source);
    await newClass.target.fromJSON(relationshipProps.target);

    return { itemKey: newClass.key };
  }

  public async createNavigationProperty(relationshipKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
    const relationshipClass = (await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey));

    if (relationshipClass === undefined)
      return { itemKey: relationshipKey, propertyName: name, errorMessage: `Relationship Class ${relationshipKey.fullName} not found in schema context.` };

    if (relationshipClass.schemaItemType !== SchemaItemType.RelationshipClass)
      return { itemKey: relationshipKey, propertyName: name, errorMessage: `Expected ${relationshipKey.fullName} to be of type Relationship Class.` };

    await relationshipClass.createNavigationProperty(name, relationship, direction);
    return { itemKey: relationshipKey, propertyName: name };
  }

  /**
   * Creates a Navigation Property through a NavigationPropertyProps.
   * @param classKey a SchemaItemKey of the Relationship Class that will house the new property.
   * @param navigationProps a json object that will be used to populate the new Navigation Property.
   */
  public async createNavigationPropertyFromProps(relationshipKey: SchemaItemKey, navigationProps: NavigationPropertyProps): Promise<PropertyEditResults> {
    const relationshipClass = await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey);

    if (relationshipClass === undefined)
      return { itemKey: relationshipKey, propertyName: navigationProps.name, errorMessage: `Relationship Class ${relationshipKey.fullName} not found in schema context.` };

    if (relationshipClass.schemaItemType !== SchemaItemType.RelationshipClass)
      return { itemKey: relationshipKey, propertyName: navigationProps.name, errorMessage: `Expected ${relationshipKey.fullName} to be of type Relationship Class.` };

    const property = await relationshipClass.createNavigationProperty(navigationProps.name, navigationProps.relationshipName, navigationProps.direction);
    await property.fromJSON(navigationProps);
    return { itemKey: relationshipKey, propertyName: navigationProps.name };
  }

  public async setConstraintMultiplicity(constraint: RelationshipConstraint, multiplicity: RelationshipMultiplicity): Promise<SchemaItemEditResults> {
    const mutableConstraint = constraint as MutableRelationshipConstraint;
    mutableConstraint.multiplicity = multiplicity;
    return { itemKey: constraint.relationshipClass.key };
  }

  public async setConstraintPolymorphic(constraint: RelationshipConstraint, polymorphic: boolean): Promise<SchemaItemEditResults> {
    const mutableConstraint = constraint as MutableRelationshipConstraint;
    mutableConstraint.polymorphic = polymorphic;
    return { itemKey: constraint.relationshipClass.key };
  }

  public async setConstraintRelationshipEnd(constraint: RelationshipConstraint, relationshipEnd: RelationshipEnd): Promise<SchemaItemEditResults> {
    const mutableConstraint = constraint as MutableRelationshipConstraint;
    mutableConstraint.relationshipEnd = relationshipEnd;
    return { itemKey: constraint.relationshipClass.key };
  }

  public async setAbstractConstraint(constraint: RelationshipConstraint, abstractConstraint?: EntityClass | Mixin | RelationshipClass): Promise<SchemaItemEditResults> {
    const existing: LazyLoadedRelationshipConstraintClass | undefined  = constraint.abstractConstraint;
    const mutableConstraint = constraint as MutableRelationshipConstraint;

    if (undefined === abstractConstraint) {
      mutableConstraint.abstractConstraint = undefined;
    } else {
      mutableConstraint.abstractConstraint = new DelayedPromiseWithProps(abstractConstraint.key, async () => abstractConstraint);
    }

    let result = await this.validate(constraint.relationshipClass);
    if (result.errorMessage) {
      mutableConstraint.abstractConstraint = existing;
      return result;
    }

    result = await this.validate(constraint);
    if (result.errorMessage) {
      mutableConstraint.abstractConstraint = existing;
      return result;
    }

    return { itemKey: constraint.relationshipClass.key };
  }

  public async addConstraintClass(constraint: RelationshipConstraint, ecClass: EntityClass | Mixin | RelationshipClass): Promise<SchemaItemEditResults> {
    const mutableConstraint = constraint as MutableRelationshipConstraint;
    mutableConstraint.addClass(ecClass);

    let result = await this.validate(constraint.relationshipClass);
    if (result.errorMessage) {
      mutableConstraint.removeClass(ecClass);
      return result;
    }

    result = await this.validate(constraint);
    if (result.errorMessage) {
      mutableConstraint.removeClass(ecClass);
      return result;
    }

    return { itemKey: constraint.relationshipClass.key };
  }

  public async removeConstraintClass(constraint: RelationshipConstraint, ecClass: EntityClass | Mixin | RelationshipClass): Promise<SchemaItemEditResults> {
    const mutableConstraint = constraint as MutableRelationshipConstraint;
    mutableConstraint.removeClass(ecClass);

    const result = await this.validate(constraint);
    if (result.errorMessage) {
      mutableConstraint.addClass(ecClass);
      return result;
    }

    return { itemKey: constraint.relationshipClass.key };
  }

  public async addCustomAttributeToConstraint(constraint: RelationshipConstraint, customAttribute: CustomAttribute): Promise<SchemaItemEditResults> {
    const mutableConstraint = constraint as MutableRelationshipConstraint;
    mutableConstraint.addCustomAttribute(customAttribute);

    const diagnostics = Rules.validateCustomAttributeInstance(constraint, customAttribute);
    const result: SchemaItemEditResults = { errorMessage: "" };
    for await (const diagnostic of diagnostics) {
      result.errorMessage += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    if (result.errorMessage) {
      this.removeCustomAttribute(constraint, customAttribute);
      return result;
    }

    return { itemKey: constraint.relationshipClass.key };
  }

  private async validate(relationshipOrConstraint: RelationshipClass | RelationshipConstraint): Promise<SchemaItemEditResults> {
    let diagnostics: AsyncIterable<SchemaItemDiagnostic<RelationshipClass, any[]>> | AsyncIterable<RelationshipConstraintDiagnostic<any[]>>;

    if (relationshipOrConstraint instanceof RelationshipClass) {
      diagnostics = Rules.validateRelationship(relationshipOrConstraint);
    } else {
      diagnostics = Rules.validateRelationshipConstraint(relationshipOrConstraint);
    }

    const errorMessages = [];
    for await (const diagnostic of diagnostics) {
      errorMessages.push(`${diagnostic.code}: ${diagnostic.messageText}`);
    }

    if (errorMessages.length > 0) {
      return { errorMessage: errorMessages.join("\r\n") };
    }

    return {};
  }
}
