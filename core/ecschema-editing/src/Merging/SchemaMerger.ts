/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { Schema, SchemaContext, SchemaItem, SchemaItemKey, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../Editing/Editor";
import { SchemaConflictsError } from "../Differencing/Errors";
import { getSchemaDifferences, type SchemaDifferenceResult } from "../Differencing/SchemaDifference";
import { SchemaMergingVisitor } from "./SchemaMergingVisitor";
import { SchemaMergingWalker } from "./SchemaMergingWalker";
import { SchemaEdits } from "./Edits/SchemaEdits";
import { ECEditingStatus, SchemaEditingError } from "../Editing/Exception";
import { NameMapping } from "./Edits/NameMapping";

/**
 * Defines the context of a Schema merging run.
 * @internal
 */
export interface SchemaMergeContext {
  readonly targetSchema: Schema;
  readonly targetSchemaKey: SchemaKey;
  readonly sourceSchemaKey: SchemaKey;
  readonly editor: SchemaContextEditor;
  readonly nameMapping: NameMapping;
}

/**
 * Class to merge two schemas together.
 * @see [[merge]] or [[mergeSchemas]] to merge two schemas together.
 * @beta
 */
export class SchemaMerger {

  private readonly _editingContext: SchemaContext;

  /**
   * Constructs a new instance of the SchemaMerger object.
   * @param editingContext  The schema contexts that holds the schema to be edited.
   */
  constructor(editingContext: SchemaContext) {
    this._editingContext = editingContext;
  }

  /**
   * Copy the SchemaItems of the source schemas to the target schema.
   * @param targetSchema  The schema the SchemaItems gets merged to.
   * @param sourceSchema  The schema the SchemaItems gets copied from.
   * @param edits         An optional instance of schema edits that shall be applied before the schemas get merged.
   * @returns             The merged target schema.
   * @alpha
   */
  public async mergeSchemas(targetSchema: Schema, sourceSchema: Schema, edits?: SchemaEdits): Promise<Schema> {
    return this.merge(await getSchemaDifferences(targetSchema, sourceSchema, edits), edits);
  }

  /**
   * Merges the schema differences into the target schema context.
   * @param differenceResult  The differences that shall be applied to the target schema.
   * @param edits             An optional instance of schema edits that shall be applied before the schemas get merged.
   * @alpha
   */
  public async merge(differenceResult: SchemaDifferenceResult, edits?: SchemaEdits): Promise<Schema> {
    const targetSchemaKey = SchemaKey.parseString(differenceResult.targetSchemaName);
    const sourceSchemaKey = SchemaKey.parseString(differenceResult.sourceSchemaName);

    const nameMapping = new NameMapping();
    const editor = new SchemaContextEditor(new MergingSchemaContext(this._editingContext, nameMapping));

    // If schema changes were provided, they'll get applied and a new SchemaDifferenceResult is returned
    // to prevent altering the differenceResult the caller passed in.
    if (edits) {
      await edits.applyTo(differenceResult = { ...differenceResult }, nameMapping);
    }

    if (differenceResult.conflicts && differenceResult.conflicts.length > 0) {
      throw new SchemaConflictsError(
        "Schema's can't be merged if there are unresolved conflicts.",
        differenceResult.conflicts,
        sourceSchemaKey,
        targetSchemaKey,
      );
    }

    const schema = await editor.getSchema(targetSchemaKey).catch((error: Error) => {
      if (error instanceof SchemaEditingError && error.errorNumber === ECEditingStatus.SchemaNotFound) {
        throw new Error(`The target schema '${targetSchemaKey.name}' could not be found in the editing context.`);
      }
      throw error;
    });

    if (!schema.isDynamic) {
      throw new Error(`The target schema '${targetSchemaKey.name}' is not dynamic. Only dynamic schemas are supported for merging.`);
    }

    const visitor = new SchemaMergingVisitor({
      editor,
      targetSchema: schema,
      targetSchemaKey,
      sourceSchemaKey,
      nameMapping,
    });

    const walker = new SchemaMergingWalker(visitor);
    await walker.traverse(differenceResult.differences, "add");
    await walker.traverse(differenceResult.differences, "modify");

    return schema;
  }
}

/**
 * SchemaContext implementation that overrides certain methods to allow to apply name mappings
 * for certain schema elements during the schema merging process.
 *
 * @internal
 */
class MergingSchemaContext extends SchemaContext {
  private _internalContext: SchemaContext;
  private _nameMappings: NameMapping;

  public constructor(internalContext: SchemaContext, nameMapping: NameMapping) {
    super();
    this._internalContext = internalContext;
    this._nameMappings = nameMapping;
  }

  public override async getCachedSchema(schemaKey: SchemaKey, matchType?: SchemaMatchType): Promise<Schema | undefined> {
    return this._internalContext.getCachedSchema(schemaKey, matchType);
  }

  public override async getSchema(schemaKey: SchemaKey, matchType?: SchemaMatchType): Promise<Schema | undefined> {
    return this._internalContext.getSchema(schemaKey, matchType);
  }

  public override async getSchemaItem<T extends typeof SchemaItem>(schemaNameOrKey: string | SchemaItemKey, itemNameOrCtor?: string | T, itemConstructor?: T): Promise<SchemaItem | InstanceType<T> | undefined> {
    let schemaItemKey: SchemaItemKey;
    if (typeof schemaNameOrKey === "string")
      schemaItemKey = new SchemaItemKey(itemNameOrCtor as string, new SchemaKey(schemaNameOrKey));
    else
      schemaItemKey = schemaNameOrKey;

    const mappedKey = this._nameMappings.resolveItemKey(schemaItemKey);
    if(mappedKey !== undefined) {
      schemaItemKey = mappedKey as SchemaItemKey;
    }

    if(itemConstructor === undefined)
      return this._internalContext.getSchemaItem(schemaItemKey);

    return this._internalContext.getSchemaItem(schemaItemKey, itemConstructor);
  }
}
