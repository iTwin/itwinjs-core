/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { _close, _onSchemaImport } from "./internal/Symbols";

export { _onSchemaImport };

/** Identifies a specific schema version for use with [[SharedSchemaReservations]].
 * @beta
 */
export interface SchemaImportIdentity {
  readonly schemaName: string;
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly versionPatch: number;
}

/** Argument for the [[SharedSchemaReservations._onSchemaImport]] hook.
 * @internal
 */
export interface OnSchemaImportArg {
  /** The identity of the schema being imported. */
  readonly identity: SchemaImportIdentity;
  /**
   * Mutable native import options that the hook may populate with reserved id ranges
   * (`schemaImportReservation` / `forceReservedIds`).
   */
  nativeOptions: Record<string, unknown>;
}

/**
 * Interface used to ***reserve*** schema-import id ranges as part of
 * [coordinating simultaneous edits]($docs/learning/backend/ConcurrencyControl.md) from multiple briefcases.
 *
 * When SchemaSync is enabled, two briefcases that import the same schema offline may allocate
 * colliding `ec_*` metadata ids. This interface lets a briefcase reserve disjoint id ranges
 * *while online*, so the subsequent offline import can consume those ranges deterministically.
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
   * Notification that a schema is about to be imported. Called from [[IModelDb.importSchemas]]
   * when a [[SchemaImportIdentity]] is supplied via [[SchemaImportOptions.schemaReservationIdentity]].
   *
   * The implementation may populate `arg.nativeOptions` with reserved id ranges so native
   * consumes the pre-allocated ids instead of allocating new ones.
   * @internal
   */
  [_onSchemaImport]: (arg: OnSchemaImportArg) => void;

  /**
   * Determine whether id ranges have already been reserved for the given schema version.
   *
   * @note Due to local caching, a return value of `true` cannot be taken as a guarantee that
   * no other briefcase has already reserved this schema version — only that no reservation was
   * seen as of the last call to [[reserveSchemaImport]].
   * @throws [[SchemaImportReservationError]] if the identity is invalid.
   */
  needsSchemaReservation(identity: SchemaImportIdentity): boolean;

  /**
   * Acquire a reservation for importing exactly one schema version.
   * The operation is all-or-nothing and idempotent: calling it twice for the same identity
   * with the same per-table counts returns the same ranges without advancing the shared counter.
   *
   * @throws [[SchemaImportReservationError]] if the identity is invalid or the reservation
   * conflicts with an existing one (same name+version, different id counts).
   */
  reserveSchemaImport(identity: SchemaImportIdentity): Promise<void>;
}
