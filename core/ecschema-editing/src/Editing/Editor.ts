/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import * as Rules from "../Validation/ECRules";
import { CustomAttribute, Schema, SchemaContext, SchemaItem, SchemaItemKey, SchemaItemType, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { MutableSchema } from "./Mutable/MutableSchema";
import { assert } from "@itwin/core-bentley";
import { Constants } from "./Constants";
import { CustomAttributes } from "./CustomAttributes";
import { Entities } from "./Entities";
import { Enumerations } from "./Enumerations";
import { Formats } from "./Formats";
import { InvertedUnits } from "./InvertedUnits";
import { KindOfQuantities } from "./KindOfQuantities";
import { Mixins } from "./Mixins";
import { Phenomena } from "./Phenomena";
import { PropertyCategories } from "./PropertyCategories";
import { RelationshipClasses } from "./RelationshipClasses";
import { Structs } from "./Structs";
import { Units } from "./Units";
import { UnitSystems } from "./UnitSystems";
import { CustomAttributeId, ECEditingStatus, SchemaEditingError, SchemaId, SchemaItemId } from "./Exception";
import { AnyDiagnostic } from "../Validation/Diagnostic";

/**
 * A class that allows you to edit and create schemas, classes, and items from the SchemaContext level.
 * @alpha
 */
export class SchemaContextEditor {
  private _schemaContext: SchemaContext;
  public readonly entities = new Entities(this);
  public readonly mixins = new Mixins(this);
  public readonly structs = new Structs(this);
  public readonly customAttributes = new CustomAttributes(this);
  public readonly relationships = new RelationshipClasses(this);
  public readonly constants = new Constants(this);
  public readonly enumerations = new Enumerations(this);
  public readonly formats = new Formats(this);
  public readonly kindOfQuantities = new KindOfQuantities(this);
  public readonly units = new Units(this);
  public readonly phenomenons = new Phenomena(this);
  public readonly unitSystems = new UnitSystems(this);
  public readonly propertyCategories = new PropertyCategories(this);
  public readonly invertedUnits = new InvertedUnits(this);

  /**
   * Creates a new SchemaContextEditor instance.
   * @param schemaContext The SchemaContext the Editor will use to edit in.
   */
  constructor(schemaContext: SchemaContext) {
    // TODO: Make copy
    this._schemaContext = schemaContext;
  }

  /** Allows you to get schema classes and items through regular SchemaContext methods. */
  public get schemaContext(): SchemaContext { return this._schemaContext; }

  public async finish(): Promise<SchemaContext> {
    return this._schemaContext;
  }

  /**
   * Helper method for retrieving a schema, previously added, from the SchemaContext.
   * @param schemaKey The SchemaKey identifying the schema.
   * @internal
  */
  public async getSchema(schemaKey: SchemaKey): Promise<MutableSchema> {
    const schema = await this.schemaContext.getCachedSchema<MutableSchema>(schemaKey, SchemaMatchType.Latest);
    if (schema === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, new SchemaId(schemaKey));

    return schema;
  }

  /**
   * Creates a Schema with the given properties and adds it to the current schema context.
   * @param name The name given to the new schema.
   * @param alias The alias of the new schema.
   * @param readVersion The read version number of the schema.
   * @param writeVersion The write version number of the schema.
   * @param minorVersion The minor version number of the schema.
   * @returns Resolves to the SchemaKey of created schema.
   */
  public async createSchema(name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number): Promise<SchemaKey> {
    const newSchema = new Schema(this._schemaContext, name, alias, readVersion, writeVersion, minorVersion);
    await this._schemaContext.addSchema(newSchema);
    return newSchema.schemaKey;
  }

  /**
   * Adds a referenced schema to the schema identified by the given SchemaKey.
   * @param schemaKey The SchemaKey identifying the schema.
   * @param refSchema The referenced schema to add.
   */
  public async addSchemaReference(schemaKey: SchemaKey, refSchema: Schema): Promise<void> {
    try {
      const schema = await this.lookupSchema(schemaKey, SchemaMatchType.Exact);
      await schema.addReference(refSchema);

      const diagnostics: AnyDiagnostic[] = [];
      for await (const diagnostic of Rules.validateSchemaReferences(schema)) {
        diagnostics.push(diagnostic);
      }

      if (diagnostics.length > 0) {
        this.removeReference(schema, refSchema);
        throw new SchemaEditingError(ECEditingStatus.RuleViolation, new SchemaId(schemaKey), undefined, diagnostics);
      }

      if (!await this.schemaContext.getCachedSchema(refSchema.schemaKey)) {
        await this.schemaContext.addSchema(refSchema);
      }
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.AddSchemaReference, new SchemaId(schemaKey), e);
    }
  }

  /**
   * Adds a CustomAttribute instance to the schema identified by the given SchemaKey
   * @param schemaKey The SchemaKey identifying the schema.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(schemaKey: SchemaKey, customAttribute: CustomAttribute): Promise<void> {
    try {
      const schema = await this.lookupSchema(schemaKey);
      schema.addCustomAttribute(customAttribute);

      const diagnostics: AnyDiagnostic[] = [];
      for await (const diagnostic of Rules.validateCustomAttributeInstance(schema, customAttribute)) {
        diagnostics.push(diagnostic);
      }

      if (diagnostics.length > 0) {
        this.removeCustomAttribute(schema, customAttribute);
        throw new SchemaEditingError(ECEditingStatus.RuleViolation, new CustomAttributeId(customAttribute.className, schema), undefined, diagnostics);
      }
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.AddCustomAttributeToClass, new SchemaId(schemaKey), e);
    }
  }

  /**
   * Sets the schema version.
   * @param schemaKey The SchemaKey identifying the schema.
   * @param readVersion The read version of the schema. If not specified, the existing read version will be maintained.
   * @param writeVersion The write version of the schema. If not specified, the existing write version will be maintained.
   * @param minorVersion The minor version of the schema. If not specified, the existing minor version will be maintained.
   * @returns Resolves to the new SchemaKey containing version updates.
   */
  public async setVersion(schemaKey: SchemaKey, readVersion?: number, writeVersion?: number, minorVersion?: number): Promise<SchemaKey> {
    try {
      const schema = await this.lookupSchema(schemaKey);
      schema.setVersion(readVersion || schema.readVersion, writeVersion || schema.writeVersion, minorVersion || schema.minorVersion);

      return schema.schemaKey;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetSchemaVersion, new SchemaId(schemaKey), e);
    }
  }

  /**
   * Increments the minor version of a schema.
   * @param schemaKey The SchemaKey identifying the schema.
   * @returns Resolves to the new SchemaKey containing version updates.
   */
  public async incrementMinorVersion(schemaKey: SchemaKey): Promise<SchemaKey> {
    try {
      const schema = await this.lookupSchema(schemaKey);
      schema.setVersion(schema.readVersion, schema.writeVersion, schema.minorVersion + 1);

      return schema.schemaKey;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.IncrementSchemaMinorVersion, new SchemaId(schemaKey), e);
    }
  }

  /** @internal */
  public async lookupSchemaItem<T extends SchemaItem>(schemaOrKey: Schema | SchemaKey, schemaItemKey: SchemaItemKey, schemaItemType: SchemaItemType): Promise<T> {
    const schema = Schema.isSchema(schemaOrKey)
      ? schemaOrKey
      : await this.getSchema(schemaOrKey);

    const schemaItem = await schema.lookupItem<T>(schemaItemKey);
    if (schemaItem === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new SchemaItemId(schemaItemType, schemaItemKey));

    if (schemaItemType !== schemaItem.schemaItemType)
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new SchemaItemId(schemaItemType, schemaItemKey));

    return schemaItem;
  }

  /** @internal */
  public async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey, schemaItemType: SchemaItemType): Promise<T> {
    const schemaItem = await this.schemaContext.getSchemaItem<T>(schemaItemKey);
    if (!schemaItem) {
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFoundInContext, new SchemaItemId(schemaItemType, schemaItemKey));
    }

    if (schemaItemType !== schemaItem.schemaItemType)
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new SchemaItemId(schemaItemType, schemaItemKey));

    return schemaItem;
  }

  private removeReference(schema: Schema, refSchema: Schema) {
    const index: number = schema.references.indexOf(refSchema);
    if (index !== -1) {
      schema.references.splice(index, 1);
    }
  }

  private removeCustomAttribute(schema: Schema, customAttribute: CustomAttribute) {
    assert(schema.customAttributes !== undefined);
    const map = schema.customAttributes as Map<string, CustomAttribute>;
    map.delete(customAttribute.className);
  }

  private async lookupSchema(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<MutableSchema> {
    const schema = await this.schemaContext.getCachedSchema<MutableSchema>(schemaKey, matchType);
    if (schema === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, new SchemaId(schemaKey));

    return schema;
  }

  /**
   * Sets the Schemas description.
   * @param schemaKey The SchemaKey identifying the schema.
   * @param description The new description to set.
   */
  public async setDescription(schemaKey: SchemaKey, description: string) {
    const schema = await this.lookupSchema(schemaKey)
      .catch((e: any) => {
        throw new SchemaEditingError(ECEditingStatus.SetDescription, new SchemaId(schemaKey), e);
      });
    schema.setDescription(description);
  }

  /**
   * Sets the Schemas display label.
   * @param schemaKey The SchemaKey identifying the schema.
   * @param label The new label to set.
   */
  public async setDisplayLabel(schemaKey: SchemaKey, label: string) {
    const schema = await this.lookupSchema(schemaKey)
      .catch((e: any) => {
        throw new SchemaEditingError(ECEditingStatus.SetLabel, new SchemaId(schemaKey), e);
      });
    schema.setDisplayLabel(label);
  }

  /**
   * Sets the Schemas alias.
   * @param schemaKey The SchemaKey identifying the schema.
   * @param alias The new alias to set.
   */
  public async setAlias(schemaKey: SchemaKey, alias: string) {
    const schema = await this.lookupSchema(schemaKey)
      .catch((e: any) => {
        throw new SchemaEditingError(ECEditingStatus.SetDescription, new SchemaId(schemaKey), e);
      });
    schema.setAlias(alias);
  }
}

