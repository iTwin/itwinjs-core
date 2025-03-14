/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import type { SchemaKey } from "@itwin/ecschema-metadata";
import type { AnySchemaDifferenceConflict } from "./SchemaConflicts";

/**
 * Error class that contains conflicts when differencing two schemas.
 * @alpha
 */
export class SchemaConflictsError extends Error {
  /** Gets an array of conflicts between two schemas. */
  public readonly conflicts: ReadonlyArray<AnySchemaDifferenceConflict>;
  /** Gets the name of the source schema. */
  public readonly sourceSchema: SchemaKey;
  /** Gets the name of the target schema. */
  public readonly targetSchema: SchemaKey;

  constructor(message: string, conflicts: AnySchemaDifferenceConflict[], sourceSchema: SchemaKey, targetSchema: SchemaKey) {
    super(message);

    this.sourceSchema = sourceSchema;
    this.targetSchema = targetSchema;
    this.conflicts = conflicts;
  }
}
