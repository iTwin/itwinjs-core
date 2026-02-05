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
import { AnySchemaDifference, getSchemaDifferences, type SchemaDifferenceResult } from "../Differencing/SchemaDifference";
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
 * Represents a single merge operation that was executed.
 * @internal
 */
export interface SchemaMergeOperation {
  readonly change: AnySchemaDifference;
  readonly durationMs: number;
}

/**
 * Represents a merge operation that failed with an error.
 * @internal
 */
export interface SchemaMergeFailure extends SchemaMergeOperation {
  readonly error: string;
}

/**
 * Report of a schema merge operation containing success/failure details.
 * @internal
 */
export interface SchemaMergeReport {
  /** Source schema identifier */
  readonly sourceSchemaKey: SchemaKey;
  /** Target schema identifier */
  readonly targetSchemaKey: SchemaKey;
  /** Array of successfully merged differences */
  readonly successfulOperations: SchemaMergeOperation[];
  /** Array of failed merge operations with their errors */
  readonly failedOperations: SchemaMergeFailure[];
  /** Summary statistics of the merge operation */
  readonly mergeStatistics: {
    readonly total: number;
    readonly succeeded: number;
    readonly failed: number;
  };

  /** Performance metrics of the merge operation */
  readonly performanceMetrics: {
    readonly totalDurationMs: number;
    readonly schemaDifferenceDurationMs: number;
    readonly mergeDurationMs: number;
    readonly averageMergeOpDurationMs: number;
  };
  /** Returns true if all operations succeeded */
  readonly success: boolean;
}

/**
 * @internal
 */
export class SchemaMergeReporter implements SchemaMergeReport {
  private readonly _succeeded: SchemaMergeOperation[] = [];
  private readonly _failed: SchemaMergeFailure[] = [];
  private readonly _sourceSchemaKey: SchemaKey;
  private readonly _targetSchemaKey: SchemaKey;
  private readonly _totalDifferences: number;
  private _totalDurationMs: number = 0;
  private _schemaDifferenceDurationMs: number = 0;
  private _mergeDurationMs: number = 0;
  private _averageMergeOpDurationMs: number = 0;

  constructor(
    sourceSchemaKey: SchemaKey,
    targetSchemaKey: SchemaKey,
    totalDifferences: number,
  ) {
    this._sourceSchemaKey = sourceSchemaKey;
    this._targetSchemaKey = targetSchemaKey;
    this._totalDifferences = totalDifferences;
  }

  public get sourceSchemaKey(): SchemaKey {
    return this._sourceSchemaKey;
  }

  public get targetSchemaKey(): SchemaKey {
    return this._targetSchemaKey;
  }

  public get successfulOperations(): SchemaMergeOperation[] {
    return [...this._succeeded];
  }

  public get failedOperations(): SchemaMergeFailure[] {
    return [...this._failed];
  }

  public get mergeStatistics() {
    return {
      total: this._totalDifferences,
      succeeded: this._succeeded.length,
      failed: this._failed.length,
    };
  }

  public get performanceMetrics() {
    return {
      totalDurationMs: this._totalDurationMs,
      schemaDifferenceDurationMs: this._schemaDifferenceDurationMs,
      mergeDurationMs: this._mergeDurationMs,
      averageMergeOpDurationMs: this._averageMergeOpDurationMs,
    };
  }

  public get success(): boolean {
    return this._failed.length === 0;
  }

  /**
   * Sets the performance metrics for the merge operation.
   * @internal
   */
  public setPerformanceMetrics(metrics: {
    totalDurationMs: number;
    schemaDifferenceDurationMs: number;
    mergeDurationMs: number;
    averageMergeOpDurationMs: number;
  }): void {
    this._totalDurationMs = metrics.totalDurationMs;
    this._schemaDifferenceDurationMs = metrics.schemaDifferenceDurationMs;
    this._mergeDurationMs = metrics.mergeDurationMs;
    this._averageMergeOpDurationMs = metrics.averageMergeOpDurationMs;
  }

  /**
   * Records a successful merge operation.
   * @internal
   */
  public recordSuccess(change: AnySchemaDifference, durationMs: number): void {
    this._succeeded.push({ change, durationMs });
  }

  /**
   * Records a failed merge operation.
   * @internal
   */
  public recordFailure(change: AnySchemaDifference, durationMs: number, error: Error): void {
    this._failed.push({ change, durationMs, error: error.message });
  }

  /**
   * Returns the merge report.
   * @internal
   */
  public getMergeReport(): SchemaMergeReport {
    return {
      sourceSchemaKey: this._sourceSchemaKey,
      targetSchemaKey: this._targetSchemaKey,
      successfulOperations: [...this._succeeded],
      failedOperations: [...this._failed],
      mergeStatistics: {
        total: this._totalDifferences,
        succeeded: this._succeeded.length,
        failed: this._failed.length,
      },
      performanceMetrics: {
        totalDurationMs: this._totalDurationMs,
        schemaDifferenceDurationMs: this._schemaDifferenceDurationMs,
        mergeDurationMs: this._mergeDurationMs,
        averageMergeOpDurationMs: this._averageMergeOpDurationMs,
      },
      get success() {
        return this.failedOperations.length === 0;
      },
    };
  }
}

/**
 * Class to merge two schemas together.
 * @see [[merge]] or [[mergeSchemas]] to merge two schemas together.
 * @beta
 */
export class SchemaMerger {

  private readonly _editingContext: SchemaContext;
  private _mergeReporter: SchemaMergeReporter | undefined;
  private _differenceStartTime: number = 0;

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
    this._differenceStartTime = performance.now();
    return this.merge(await getSchemaDifferences(targetSchema, sourceSchema, edits), edits);
  }

  /**
   * Merges the schema differences into the target schema context.
   * @param differenceResult  The differences that shall be applied to the target schema.
   * @param edits             An optional instance of schema edits that shall be applied before the schemas get merged.
   * @alpha
   */
  public async merge(differenceResult: SchemaDifferenceResult, edits?: SchemaEdits): Promise<Schema> {
    const mergeStartTime = performance.now();

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

    // Initialize the merge reporter
    this._mergeReporter = new SchemaMergeReporter(sourceSchemaKey, targetSchemaKey, differenceResult.differences.length);
    visitor.setReporter(this._mergeReporter);

    const walker = new SchemaMergingWalker(visitor);
    await walker.traverse(differenceResult.differences, "add");
    await walker.traverse(differenceResult.differences, "modify");

    const mergeEndTime = performance.now();

    // Calculate performance metrics
    const effectiveStartTime = this._differenceStartTime === 0 ? mergeStartTime : this._differenceStartTime;
    const schemaDifferenceDurationMs = mergeStartTime - effectiveStartTime;
    const mergeDurationMs = mergeEndTime - mergeStartTime;
    const totalDurationMs = mergeEndTime - effectiveStartTime;

    this._mergeReporter.setPerformanceMetrics({
      totalDurationMs,
      schemaDifferenceDurationMs,
      mergeDurationMs,
      averageMergeOpDurationMs: this._mergeReporter.mergeStatistics.total > 0 ? mergeDurationMs / this._mergeReporter.mergeStatistics.total : 0,
    });

    return schema;
  }

  /**
   * Gets the merge report for the last merge operation.
   * @alpha
   */
  public getMergeReport(): SchemaMergeReport | undefined {
    return this._mergeReporter?.getMergeReport();
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
    if (mappedKey !== undefined) {
      schemaItemKey = mappedKey as SchemaItemKey;
    }

    if (itemConstructor === undefined)
      return this._internalContext.getSchemaItem(schemaItemKey);

    return this._internalContext.getSchemaItem(schemaItemKey, itemConstructor);
  }
}
