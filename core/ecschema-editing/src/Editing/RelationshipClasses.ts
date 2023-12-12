/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps,
  ECClassModifier,
  ECObjectsError, ECObjectsStatus, EntityClass, LazyLoadedRelationshipConstraintClass, Mixin, RelationshipClass, RelationshipClassProps, RelationshipConstraint, RelationshipEnd, RelationshipMultiplicity, SchemaItemKey, SchemaItemType,
  SchemaKey, StrengthDirection, StrengthType,
} from "@itwin/ecschema-metadata";
import { PropertyEditResults, SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableRelationshipClass, MutableRelationshipConstraint } from "./Mutable/MutableRelationshipClass";
import * as Rules from "../Validation/ECRules";
import { RelationshipConstraintDiagnostic, SchemaItemDiagnostic } from "../ecschema-editing";

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
    if (newClass === undefined) {
      return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };
    }

    if (baseClassKey !== undefined) {
      let baseClassSchema = schema;
      if (!baseClassKey.schemaKey.matches(schema.schemaKey))
        baseClassSchema = await this._schemaEditor.getSchema(baseClassKey.schemaKey);

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
      return { errorMessage: `Relationship Class ${relationshipKey.fullName} not found in schema context.` };

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
      return { errorMessage: `Relationship Class ${relationshipKey.fullName} not found in schema context.` };

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
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${relationshipProps.name} in schema ${schemaKey.toString(true)}.` };

    await newClass.fromJSON(relationshipProps);
    await newClass.source.fromJSON(relationshipProps.source);
    await newClass.target.fromJSON(relationshipProps.target);

    return { itemKey: newClass.key };
  }

  public async createNavigationProperty(relationshipKey: SchemaItemKey, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<PropertyEditResults> {
    const relationshipClass = (await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey));

    if (relationshipClass === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Relationship Class ${relationshipKey.fullName} not found in schema context.`);

    if (relationshipClass.schemaItemType !== SchemaItemType.RelationshipClass)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected ${relationshipKey.fullName} to be of type Relationship Class.`);

    await relationshipClass.createNavigationProperty(name, relationship, direction);
    return { itemKey: relationshipKey, propertyName: name };
  }

  public async sourceConstraints(relationshipKey: SchemaItemKey): Promise<RelationshipConstraints> {
    const relationship = (await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey));
    if (relationship === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Relationship Class ${relationshipKey.fullName} not found in schema context.`);

    return new RelationshipConstraints(this._schemaEditor, relationship?.source);
  }

  public async targetConstraints(relationshipKey: SchemaItemKey): Promise<RelationshipConstraints> {
    const relationship = (await this._schemaEditor.schemaContext.getSchemaItem<MutableRelationshipClass>(relationshipKey));
    if (relationship === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Relationship Class ${relationshipKey.fullName} not found in schema context.`);

    return new RelationshipConstraints(this._schemaEditor, relationship?.target);
  }
}

/**
 * @alpha
 * A class allowing you to edit RelationshipConstraints
 */
export class RelationshipConstraints {
  constructor(public schemaEditor: SchemaContextEditor, private _constraint: MutableRelationshipConstraint) {
  }

  public async setMultiplicity(multiplicity: RelationshipMultiplicity): Promise<SchemaItemEditResults> {
    this._constraint.multiplicity = multiplicity;
    return {};
  }

  public async setPolymorphic(polymorphic: boolean): Promise<SchemaItemEditResults> {
    this._constraint.polymorphic = polymorphic;
    return {};
  }

  public async setRoleLabel(roleLabel: string | undefined): Promise<SchemaItemEditResults> {
    this._constraint.roleLabel = roleLabel;
    return {};
  }

  public async setRelationshipEnd(relationshipEnd: RelationshipEnd): Promise<SchemaItemEditResults> {
    this._constraint.relationshipEnd = relationshipEnd;
    return {};
  }

  public async setAbstractConstraint(constraint?: EntityClass | Mixin | RelationshipClass){
    const existing: LazyLoadedRelationshipConstraintClass | undefined  = this._constraint.abstractConstraint;

    if (undefined === constraint) {
      this._constraint.abstractConstraint = undefined;
      return;
    } else {
      this._constraint.abstractConstraint = new DelayedPromiseWithProps(constraint.key, async () => constraint);
    }

    let result = await this.validate(this._constraint.relationshipClass);
    if (result.errorMessage) {
      this._constraint.abstractConstraint = existing;
      return result;
    }

    result = await this.validate(this._constraint);
    if (result.errorMessage) {
      this._constraint.abstractConstraint = existing;
      return result;
    }

    return {};
  }

  public async addClass(constraint: EntityClass | Mixin | RelationshipClass): Promise<SchemaItemEditResults> {
    this._constraint.addClass(constraint);

    let result = await this.validate(this._constraint.relationshipClass);
    if (result.errorMessage) {
      this._constraint.removeClass(constraint);
      return result;
    }

    result = await this.validate(this._constraint);
    if (result.errorMessage) {
      this._constraint.removeClass(constraint);
      return result;
    }

    return {};
  }

  public async removeClass(constraint: EntityClass | Mixin | RelationshipClass): Promise<SchemaItemEditResults> {
    this._constraint.removeClass(constraint);

    const result = await this.validate(this._constraint);
    if (result.errorMessage) {
      this._constraint.addClass(constraint);
      return result;
    }

    return {};
  }

  private async validate(relationshipOrConstraint: RelationshipClass | RelationshipConstraint): Promise<SchemaItemEditResults> {
    let diagnostics: AsyncIterable<SchemaItemDiagnostic<RelationshipClass, any[]>> | AsyncIterable<RelationshipConstraintDiagnostic<any[]>>;

    if (relationshipOrConstraint instanceof RelationshipClass) {
      diagnostics = Rules.validateRelationship(this._constraint.relationshipClass);
    } else {
      diagnostics = Rules.validateRelationshipConstraint(this._constraint);
    }

    const result: SchemaItemEditResults = { errorMessage: "" };
    for await (const diagnostic of diagnostics) {
      result.errorMessage += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    return {};
  }
}
