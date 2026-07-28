/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { SchemaManifest } from "./SchemaManifest";
import { SchemaView } from "./SchemaView";

/** One schema-view blob with its cache-invalidation token, as fetched by a
 * {@link SchemaViewDataProvider}. Full and fragment blobs share this shape.
 * @internal
 */
export interface SchemaViewBlob {
  /** The binary schema metadata (the `data` column of `PRAGMA schema_view` / `schema_view_fragment`). */
  readonly data: Uint8Array;
  /** Schema-identity hash of the iModel's whole schema set (the `schemaToken` column). Empty string when unavailable. */
  readonly schemaToken: string;
}

/** The data source a {@link SchemaViewManager} loads schema-view data from, implemented by the hosts
 * that own the query APIs: `IModelDb` on the backend and `IModelConnection` on the frontend. The
 * manager deals only in schema names, blobs and the manifest; everything transport-specific - pragma
 * strings, format-version pinning - belongs to the provider.
 * @internal
 */
export interface SchemaViewDataProvider {
  /** Fetch the blob containing every schema in the iModel (`PRAGMA schema_view`). */
  fetchFullBlob(): Promise<SchemaViewBlob>;

  /** Fetch one blob containing exactly the given schemas (`PRAGMA schema_view_fragment`). The
   * requested set is always dependency-closed - the manager computes the reference closure from the
   * manifest before calling. */
  fetchFragmentBlob(schemaNames: readonly string[]): Promise<SchemaViewBlob>;

  /** Fetch the reference graph of every schema in the iModel, built from ECDbMeta
   * (`meta.ECSchemaDef` + `meta.SchemaHasSchemaReferences`; see {@link SchemaManifest.fromRows}). */
  fetchManifest(): Promise<SchemaManifest>;

  /** Fetch the current schema-identity token (`PRAGMA checksum(schema_token)`). */
  fetchSchemaToken(): Promise<string>;
}

/** Options for `getSchemaView` (see `IModelDb.getSchemaView` / `IModelConnection.getSchemaView`,
 * which delegate to {@link SchemaViewManager.getSchemaView}).
 * @beta
 */
export interface GetSchemaViewArgs {
  /** When provided, return a view loaded with at least these schemas plus their references, instead
   * of every schema in the iModel.
   *
   * The view accumulates: one instance is reused across calls, so a later request - with different
   * schemas or with no filter at all - merges the still-missing schemas into the same view and
   * everything requested earlier stays available. It resets when the iModel's schemas change.
   *
   * Names the iModel does not contain are ignored. Omitting this option loads all schemas, identical
   * to calling `getSchemaView()` with no arguments.
   */
  readonly schemas?: readonly string[];

  /** When `true`, discard whatever is currently loaded and rebuild the view from scratch before
   * returning it. The previously returned view instance (if any) is marked outdated. Like every other
   * request this is serialized behind any in-flight load, so it never leaves the view in an invalid
   * intermediate state.
   * @internal
   */
  readonly forceReload?: boolean;
}

/** Owns the lifetime of one iModel's {@link (SchemaView:class)}: lazy loading, incremental (filtered)
 * hydration, serialization of concurrent requests, and invalidation. Hosts (`IModelDb`,
 * `IModelConnection`) hold one instance and delegate to it; all data access goes through the
 * host-implemented {@link SchemaViewDataProvider}.
 * @internal
 */
export class SchemaViewManager {
  private readonly _dataProvider: SchemaViewDataProvider;

  /** The single accumulating view, held as a promise so all requests chain onto it and never overlap.
   * Undefined (or resolving to undefined) means nothing is loaded. */
  private _viewPromise?: Promise<SchemaView | undefined>;

  /** Reference graph for incremental loading; undefined when the view is (or will be) fully loaded. */
  private _manifest?: SchemaManifest;

  /** Schema-identity token the manifest - and thus every fragment merged under it - belongs to. */
  private _manifestToken?: string;

  /** Lower-cased names already merged into the view (incremental mode only). */
  private readonly _loadedSchemaNames = new Set<string>();

  public constructor(dataProvider: SchemaViewDataProvider) {
    this._dataProvider = dataProvider;
  }

  /** Get the schema view, loading whatever the request needs that is not present yet. See
   * {@link GetSchemaViewArgs} for filtering and reload semantics; hosts document the full
   * user-facing contract on their `getSchemaView` methods.
   */
  public async getSchemaView(args?: GetSchemaViewArgs): Promise<SchemaView> {
    const previous = this._viewPromise;
    const next = this._loadSchemaView(previous, args?.schemas, args?.forceReload === true);
    this._viewPromise = next;
    return next;
  }

  /** Throw away the current schema view. Called by the host when schemas may have changed (e.g.
   * `IModelDb.clearCaches` after a schema import). Chains behind any in-flight load and marks the
   * discarded view outdated; the next getSchemaView starts over.
   */
  public reset(): void {
    if (this._viewPromise) {
      this._viewPromise = this._viewPromise.then(
        (view) => { view?.markOutdated(); this._resetIncrementalState(); return undefined; },
        () => { this._resetIncrementalState(); return undefined; },
      );
    }
  }

  /** Check whether the iModel's schemas have changed since the current view was built, and discard
   * the view only if they have. For hosts that *cannot* determine whether an operation actually
   * modified schemas - e.g. `BriefcaseConnection.pullChanges` on the frontend, whose IPC response
   * carries only the new changeset id, not the applied changesets' types. Discarding after every
   * such operation would reload unnecessarily in the common case where schemas are unchanged, so
   * this compares the cheap schema-identity token instead.
   * @note If the token cannot be fetched, the view is discarded rather than risking stale metadata.
   */
  public async invalidateIfChanged(): Promise<void> {
    const previous = this._viewPromise;
    if (previous === undefined)
      return;
    // Queue the check on the same chain as loading, so a getSchemaView arriving while the token is
    // in flight cannot swap in a new promise for the same stale view and hide the schema change.
    const next = this._invalidateIfChanged(previous);
    this._viewPromise = next;
    await next;
  }

  /** Serialized body of {@link SchemaViewManager.invalidateIfChanged}. Resolves to the view to keep,
   * or to `undefined` when it was discarded and the next getSchemaView has to start over.
   */
  private async _invalidateIfChanged(previous: Promise<SchemaView | undefined>): Promise<SchemaView | undefined> {
    let existing: SchemaView | undefined;
    try {
      existing = await previous;
    } catch {
      return undefined;
    }
    if (existing === undefined)
      return undefined;
    // A view without a token (e.g. built directly from a SchemaViewBuilder) cannot be verified by
    // token; views loaded through this manager always carry one.
    if (existing.schemaToken === "")
      return existing;

    try {
      if (await this._dataProvider.fetchSchemaToken() === existing.schemaToken)
        return existing;
    } catch {
      // Cannot verify the cached view: drop it rather than risk stale metadata.
    }
    existing.markOutdated();
    this._resetIncrementalState();
    return undefined;
  }

  /** Serialized body of {@link SchemaViewManager.getSchemaView}. On failure it resets and rejects,
   * so the next call starts over.
   */
  private async _loadSchemaView(previous: Promise<SchemaView | undefined> | undefined, schemas: readonly string[] | undefined, forceReload: boolean): Promise<SchemaView> {
    let currentView: SchemaView | undefined;
    if (previous !== undefined) {
      try {
        currentView = await previous;
      } catch {
        currentView = undefined; // the failed load already reset; start over
      }
    }

    if (forceReload) {
      currentView?.markOutdated();
      currentView = undefined;
      this._resetIncrementalState();
    }

    try {
      return await this._ensureSchemasLoaded(currentView, schemas);
    } catch (err) {
      // A failed merge may have left the view partially extended - discard everything.
      currentView?.markOutdated();
      this._resetIncrementalState();
      throw err;
    }
  }

  /** Clear the incremental schema-view bookkeeping. */
  private _resetIncrementalState(): void {
    this._manifest = undefined;
    this._manifestToken = undefined;
    this._loadedSchemaNames.clear();
  }

  /** Ensures the requested schemas (or all schemas, when no filter is given) are present in
   * `currentView` (or a freshly created view) and returns it. The first load fixes the strategy:
   * no filter fetches everything as one full blob; a filter fetches fragments and keeps the
   * manifest and loaded-name set so later calls extend the same view. Once every schema is loaded
   * the incremental state is dropped, collapsing back to full mode.
   */
  private async _ensureSchemasLoaded(currentView: SchemaView | undefined, schemas: readonly string[] | undefined, isRetry = false): Promise<SchemaView> {
    const isFirstLoad = currentView === undefined;
    // No manifest means everything is loaded; in incremental mode a filtered request is satisfied as
    // soon as every requested name is present.
    if (!isFirstLoad &&
        (this._manifest === undefined ||
        (schemas !== undefined && schemas.every((name) => this._loadedSchemaNames.has(name.toLowerCase())))))
      return currentView;

    if (isFirstLoad && schemas === undefined) {
      const blob = await this._dataProvider.fetchFullBlob();
      const schemaView = SchemaView.fromBinary(blob.data, blob.schemaToken);
      this._resetIncrementalState();
      return schemaView;
    }

    if (this._manifest === undefined) {
      // Token first: any schema change after this point shows up as a token mismatch below.
      this._manifestToken = await this._dataProvider.fetchSchemaToken();
      this._manifest = await this._dataProvider.fetchManifest();
    }
    const manifest = this._manifest;

    const requested = schemas ?? manifest.getAvailableSchemaNames();
    const namesToLoad = manifest.getSchemaClosure(requested).filter((name) => !this._loadedSchemaNames.has(name.toLowerCase()));
    const husk = currentView ?? SchemaView.createMergeable(this._manifestToken);
    if (namesToLoad.length > 0) {
      const blob = await this._dataProvider.fetchFragmentBlob(namesToLoad);
      if (blob.schemaToken !== this._manifestToken) {
        // Schemas changed between the manifest and fragment fetches. Everything loaded so far
        // belongs to the old revision - discard it and start over, once.
        currentView?.markOutdated();
        this._resetIncrementalState();
        if (isRetry)
          throw new Error("The iModel's schemas changed while the schema view was loading.");
        return this._ensureSchemasLoaded(undefined, schemas, true);
      }
      husk.mergeFragment(blob.data);
      // Record the whole closure as loaded, including *excluded* schemas (e.g. CoreCustomAttributes)
      // the writer emits no rows for, so later requests prune them instead of re-fetching.
      for (const name of namesToLoad)
        this._loadedSchemaNames.add(name.toLowerCase());
    }
    // Once every schema is loaded, collapse back to full mode (the size check is just a fast path).
    if (schemas === undefined || (this._loadedSchemaNames.size >= manifest.schemaCount && manifest.entries.every((entry) => this._loadedSchemaNames.has(entry.name.toLowerCase()))))
      this._resetIncrementalState();
    return husk;
  }
}
