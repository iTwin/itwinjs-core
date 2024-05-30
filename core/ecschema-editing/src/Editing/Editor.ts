/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import * as Rules from "../Validation/ECRules";
import { CustomAttribute, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
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
import { ECEditingError, ECEditingStatus } from "./Exception";
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

  /** @internal */
  // public readonly schemaItems = new SchemaItems(this);

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
  */
  public async getSchema(schemaKey: SchemaKey): Promise<MutableSchema | undefined> {
    const schema = (await this.schemaContext.getCachedSchema<MutableSchema>(schemaKey, SchemaMatchType.Latest));
    if (schema === undefined)
      return undefined;

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
    const schema = (await this.schemaContext.getCachedSchema<MutableSchema>(schemaKey, SchemaMatchType.Exact));
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    await schema.addReference(refSchema);
    const diagnosticIterable = Rules.validateSchemaReferences(schema);

    const diagnostics: AnyDiagnostic[] = [];
    for await (const diagnostic of diagnosticIterable) {
      diagnostics.push(diagnostic);
    }

    if (diagnostics.length > 0) {
      this.removeReference(schema, refSchema);
      throw new ECEditingError(ECEditingStatus.RuleViolation, undefined, diagnostics);
    }

    if (!await this.schemaContext.getCachedSchema(refSchema.schemaKey)) {
      await this.schemaContext.addSchema(refSchema);
    }
  }

  /**
   * Adds a CustomAttribute instance to the schema identified by the given SchemaKey
   * @param schemaKey The SchemaKey identifying the schema.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(schemaKey: SchemaKey, customAttribute: CustomAttribute): Promise<void> {
    const schema = (await this.schemaContext.getCachedSchema<MutableSchema>(schemaKey, SchemaMatchType.Latest));
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    schema.addCustomAttribute(customAttribute);

    const diagnosticIterable = Rules.validateCustomAttributeInstance(schema, customAttribute);

    const diagnostics: AnyDiagnostic[] = [];
    for await (const diagnostic of diagnosticIterable) {
      diagnostics.push(diagnostic);
    }

    if (diagnostics.length > 0) {
      this.removeCustomAttribute(schema, customAttribute);
      throw new ECEditingError(ECEditingStatus.RuleViolation, undefined, diagnostics);
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
    const schema = (await this.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest));
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    schema.setVersion(readVersion || schema.readVersion, writeVersion || schema.writeVersion, minorVersion || schema.minorVersion);
    return schema.schemaKey;
  }

  /**
   * Increments the minor version of a schema.
   * @param schemaKey The SchemaKey identifying the schema.
   * @returns Resolves to the new SchemaKey containing version updates.
   */
  public async incrementMinorVersion(schemaKey: SchemaKey): Promise<SchemaKey> {
    const schema = (await this.schemaContext.getCachedSchema(schemaKey, SchemaMatchType.Latest));
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    schema.setVersion(schema.readVersion, schema.writeVersion, schema.minorVersion + 1);
    return schema.schemaKey;
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
}

