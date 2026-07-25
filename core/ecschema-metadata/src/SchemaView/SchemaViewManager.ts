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
 * @beta
 */
export interface SchemaViewBlob {
  /** The binary schema metadata (the `data` column of `PRAGMA schema_view` / `schema_view_fragment`). */
  readonly data: Uint8Array;
  /** Schema-identity hash of the iModel's whole schema set (the `schemaToken` column). The token is
   * the same for a full blob or any fragment. Empty string when unavailable. */
  readonly schemaToken: string;
}

/** The data source a {@link SchemaViewManager} loads schema-view data from, implemented by the hosts
 * that own the query APIs: `IModelDb` on the backend and `IModelConnection` on the frontend. The
 * manager deals only in schema names, blobs and the manifest; everything transport-specific - pragma
 * strings, format-version pinning, mapping names to `ec_Schema` ids - belongs to the provider.
 * @beta
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

  /** Fetch the current schema-identity token (`PRAGMA checksum(schema_token)`), used by
   * {@link SchemaViewManager.invalidateIfChanged} to detect schema changes. */
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
 * @beta
 */
export class SchemaViewManager {
  private readonly _dataProvider: SchemaViewDataProvider;

  // Single accumulating schema view, held as a promise so every getSchemaView call chains onto it
  // and loads never overlap. An `undefined` field, or a promise resolving to `undefined` (the
  // continuation queued by `reset`), both mean nothing is loaded.
  private _viewPromise?: Promise<SchemaView | undefined>;

  // Loaded lazily the first time an incremental (filtered) load is needed. `undefined` means either
  // the view is fully loaded, or nothing was loaded yet (`_viewPromise` is undefined too).
  private _manifest?: SchemaManifest;

  // Lower-cased names already merged into the SchemaView. Only used in incremental mode, to decide
  // what a later filtered request still needs.
  private readonly _loadedSchemaNames = new Set<string>();

  public constructor(dataProvider: SchemaViewDataProvider) {
    this._dataProvider = dataProvider;
  }

  /** Get the schema view, loading whatever the request needs that is not present yet. See
   * {@link GetSchemaViewArgs} for filtering and reload semantics; hosts document the full
   * user-facing contract on their `getSchemaView` methods.
   */
  public async getSchemaView(args?: GetSchemaViewArgs): Promise<SchemaView> {
    // Chain onto the previous request so loads run one at a time and only a single in-flight load
    // ever mutates the shared state. `_loadSchemaView` swallows the previous load's failure; each
    // caller observes its own outcome through the promise returned here.
    const previous = this._viewPromise;
    const next = this._loadSchemaView(previous, args?.schemas, args?.forceReload === true);
    this._viewPromise = next;
    return next;
  }

  /** Throw away the current schema view. Called by the host when it *knows* schemas may have
   * changed (e.g. `IModelDb.clearCaches` after a schema import). The teardown chains behind any
   * in-flight load, marks the discarded view outdated and clears the incremental bookkeeping. The
   * next getSchemaView chains after this and starts over.
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
    const existingPromise = this._viewPromise;
    if (existingPromise === undefined)
      return;
    let existing: SchemaView | undefined;
    try {
      existing = await existingPromise;
    } catch {
      // The load failed; the next getSchemaView chains onto the rejected promise and rebuilds anyway.
      return;
    }
    // Nothing loaded (reset continuation) - nothing to invalidate.
    if (existing === undefined)
      return;
    // A husk with no token and no cached manifest never fetched anything. With a manifest an
    // incremental request did run (loading only the manifest, e.g. all its names were missing), and
    // that manifest can go stale - fall through so the token check drops it; a live token can never
    // equal "".
    if (existing.schemaToken === "" && this._manifest === undefined)
      return;
    try {
      const liveToken = await this._dataProvider.fetchSchemaToken();
      if (liveToken === existing.schemaToken || this._viewPromise !== existingPromise)
        return;
    } catch {
      // Cannot verify the cached view: drop it rather than risk stale metadata. The guard keeps a
      // concurrent reload's fresh view from being discarded by this stale check.
      if (this._viewPromise !== existingPromise)
        return;
    }
    this.reset();
    // Await the queued teardown so callers like pullChanges see the invalidation fully applied.
    await this._viewPromise;
  }

  /** Serialized body of {@link SchemaViewManager.getSchemaView}. Waits for the prior load, optionally discards
   * everything (`forceReload`), then ensures the requested schemas (or all schemas, when no filter
   * is given) are present in the single accumulating view. On failure it resets and rejects, so the
   * next call retries from scratch.
   */
  private async _loadSchemaView(previous: Promise<SchemaView | undefined> | undefined, schemas: readonly string[] | undefined, forceReload: boolean): Promise<SchemaView> {
    // A prior failure or reset leaves no usable view, so we simply start over.
    let currentView: SchemaView | undefined;
    if (previous !== undefined) {
      try {
        currentView = await previous;
      } catch {
        currentView = undefined;
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
      // `_viewPromise` deliberately keeps pointing at this (now rejected) promise: the next call
      // chains onto it, catches the rejection above and rebuilds, which also avoids stomping any
      // newer queued load. A failed merge may have left the current view partially extended, so
      // mark it outdated for callers still holding it.
      currentView?.markOutdated();
      this._resetIncrementalState();
      throw err;
    }
  }

  /** Clear the incremental schema-view bookkeeping. */
  private _resetIncrementalState(): void {
    this._manifest = undefined;
    this._loadedSchemaNames.clear();
  }

  /** Ensures the requested schemas (or all schemas, when no filter is given) are present in
   * `currentView`, or in a freshly created view when nothing is loaded yet, and returns it.
   *
   * The strategy is fixed by the *first* load:
   *  - No filter -> fetch every schema as one full blob (one round trip, best cross-schema dedup).
   *    `_manifest` stays `undefined` and all later calls short-circuit.
   *  - Filter -> fetch only the requested schemas and their references as a fragment blob, and keep
   *    the manifest and loaded-name set to extend the *same* view on later calls. Once every schema
   *    has been loaded this way, `_manifest` is cleared to collapse back to full mode.
   */
  private async _ensureSchemasLoaded(currentView: SchemaView | undefined, schemas: readonly string[] | undefined): Promise<SchemaView> {
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

    let manifest = this._manifest;
    if (manifest === undefined)
      manifest = this._manifest = await this._dataProvider.fetchManifest();

    // No filter in incremental mode means "load whatever is left".
    const requested = schemas ?? manifest.getAvailableSchemaNames();
    // The manifest returns the whole closure of the request; dropping the already-loaded schemas is
    // our concern, not the manifest's. Fragment load order does not matter (see the writer).
    const namesToLoad = manifest.getSchemaClosure(requested).filter((name) => !this._loadedSchemaNames.has(name.toLowerCase()));
    const husk = currentView ?? SchemaView.createMergeable();
    if (namesToLoad.length > 0) {
      const blob = await this._dataProvider.fetchFragmentBlob(namesToLoad);
      husk.mergeFragment(blob.data);
      husk.setSchemaToken(blob.schemaToken);
      // Record every closure entry as loaded, including *excluded* schemas (e.g. CoreCustomAttributes)
      // that the writer emits no rows for and so never appear in the view. Tracking names rather than
      // view contents is what lets a later request prune them instead of re-fetching.
      for (const name of namesToLoad)
        this._loadedSchemaNames.add(name.toLowerCase());
    }
    // Once everything is loaded, drop the incremental state so future requests hit the fast path above.
    if (schemas === undefined || (this._loadedSchemaNames.size >= manifest.schemaCount && manifest.entries.every((entry) => this._loadedSchemaNames.has(entry.name.toLowerCase()))))
      this._resetIncrementalState();
    return husk;
  }
}
