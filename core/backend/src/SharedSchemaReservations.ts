/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { _close } from "./internal/Symbols";

/**
 * Interface used to ***reserve*** schema-import `key→id` mappings as part of
 * [coordinating simultaneous edits]($docs/learning/backend/ConcurrencyControl.md) from multiple briefcases.
 *
 * When SchemaSync is enabled, two briefcases that import the same schema offline may allocate
 * colliding `ec_*` metadata ids. This interface lets a briefcase reserve per-row `key→id` mappings
 * *while online* into the shared sync-db store, so the subsequent import reads those ids from the
 * store instead of allocating new ones — making merges collision-free by construction.
 *
 * @see [[IModelDb.schemaReservations]] to access the schema reservations for an iModel.
 * @beta
 */
export interface SharedSchemaReservations {
  /** @internal true if this implementation uses a server-based concurrency approach. */
  readonly isServerBased: boolean;

  /**
   * Close the underlying reservation database handle.
   * @internal
   */
  [_close]: () => void;

  /**
   * Reserve `key→id` mappings for importing the given schema files into the shared sync-db store.
   * The operation is all-or-nothing and idempotent: reserving keys already present in the store
   * is a no-op that returns the same ids without advancing any counter.
   *
   * @param schemaFileNames Paths to schema XML files on disk, or raw XML strings when `sourceType="xml"`.
   * @param sourceType `"file"` (default) — `schemaFileNames` contains file-system paths;
   *                   `"xml"` — `schemaFileNames` contains serialized XML strings.
   * @throws [SchemaImportReservationError]($common) with code `"invalid-argument"` if
   *   `schemaFileNames` is not a non-empty array of strings.
   * @beta
   */
  reserveSchemaImport(schemaFileNames: string[], sourceType?: "file" | "xml"): Promise<void>;
}
