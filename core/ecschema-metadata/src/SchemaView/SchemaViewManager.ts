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
 * {@link SchemaViewDataProvider}. Full and fragment blobs share this shape - a fragment is a
 * content subset of the identical binary format.
 * @beta
 */
export interface SchemaViewBlob {
  /** The binary schema metadata (the `data` column of `PRAGMA schema_view` / `schema_view_fragment`). */
  readonly data: Uint8Array;
  /** Schema-identity hash of the iModel's whole schema set (the `schemaToken` column). The token is
   * the same for a full blob or any fragment. Empty string when unavailable. */
  readonly schemaToken: string;
}

/** The data source a {@link SchemaViewManager} loads schema-view data from. Implemented by the
 * hosts that own the actual query APIs - `IModelDb` on the backend and `IModelConnection` on the
 * frontend. The manager stays free of any query or transport dependency: it requests data purely in
 * terms of schema names and receives blobs and the manifest. Anything transport-specific - pragma
 * strings, format-version pinning, the mapping of schema names to `ec_Schema` ids - is the
 * provider's concern.
 * @beta
 */
export interface SchemaViewDataProvider {
  /** Fetch the blob containing every schema in the iModel (`PRAGMA schema_view`). */
  fetchFullBlob(): Promise<SchemaViewBlob>;

  /** Fetch one blob containing exactly the given schemas (`PRAGMA schema_view_fragment`). The
   * requested set is always dependency-closed - the manager computes the reference closure from the
   * manifest before calling. The pragma takes the schema names directly. */
  fetchFragmentBlob(schemaNames: readonly string[]): Promise<SchemaViewBlob>;

  /** Fetch the reference graph of every schema in the iModel, built from ECDbMeta
   * (`meta.ECSchemaDef` + `meta.SchemaHasSchemaReferences`; see {@link SchemaManifest.fromRows}).
   * No schema data is hydrated - just names, versions, and reference edges. */
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
  /** When provided, return a view incrementally loaded with at least these schemas plus their
   * references, instead of every schema in the iModel.
   * The parameter means "I need these schemas to be present".
   *
   * The view accumulates: one instance reused across calls, so a later request with different
   * schemas - or a later call with no filter at all - merges any still-missing schemas into the same
   * view, and schemas requested earlier remain available. Resets when schemas in the iModel change.
   *
   * Names the iModel does not contain are ignored. Omitting this option ensures all schemas are
   * loaded, identical to calling `getSchemaView()` with no arguments.
   */
  readonly schemas?: readonly string[];

  /** When `true`, discard whatever is currently loaded and rebuild the view from scratch before
   * returning it. The previously returned view instance (if any) is marked outdated. Like every other
   * request, this is serialized behind any in-flight load, so it waits for pending work to finish before
   * resetting - never leaving the view in an invalid intermediate state.
   * @internal
   */
  readonly forceReload?: boolean;
}

/** Owns the lifetime of one iModel's {@link SchemaView}: lazy loading, incremental (filtered)
 * hydration, serialization of concurrent requests, and invalidation. Hosts (`IModelDb`,
 * `IModelConnection`) hold one instance and delegate to it; all data access goes through the
 * host-implemented {@link SchemaViewDataProvider}.
 * @beta
 */
export class SchemaViewManager {
  private readonly _dataProvider: SchemaViewDataProvider;

  // Single accumulating schema view, exposed as a promise to serialize all access. Every
  // getSchemaView call chains onto this promise, so the state transitions never overlap and the
  // view can never be double-merged. An `undefined` field, or a promise that resolves to
  // `undefined` (the reset continuation queued by `reset`), both mean "nothing loaded - start
  // over". A promise resolving to a `SchemaView` is the accumulating or fully loaded view; a later
  // call merges any still-missing schemas into the same instance.
  private _viewPromise?: Promise<SchemaView | undefined>;

  // Cheap reference graph (names, versions, reference edges) of every schema in the iModel, loaded
  // lazily the first time an incremental (filtered) load is needed. `undefined` means the view is
  // fully loaded, so no manifest is needed - or nothing was loaded yet, in which case `_viewPromise`
  // is undefined as well.
  private _manifest?: SchemaManifest;

  // Lower-cased names already merged into the SchemaView. Used only in incremental mode to decide
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
    // Every request chains onto the previous one, so loads run strictly one at a time and the shared
    // state (manifest, and loaded-name set) is only ever mutated by a single in-flight load.
    // The continuation swallows the previous load's failure - each caller observes its own outcome
    // through the promise returned here.
    const previous = this._viewPromise;
    const next = this._loadSchemaView(previous, args?.schemas, args?.forceReload === true);
    this._viewPromise = next;
    return next;
  }

  /** Throw away the current schema view. Called by the host when it *knows* schemas may have
   * changed (e.g. `IModelDb.clearCaches` after a schema import). The teardown chains behind any
   * in-flight load, so it runs after that load finishes mutating the shared state, then marks the
   * discarded view outdated and clears the incremental bookkeeping. The next getSchemaView chains
   * after this and starts over.
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
   * modified schemas (e.g. `BriefcaseConnection.pullChanges` on the frontend - the IPC response
   * carries only the new changeset id, not the applied changesets' types). Unconditionally
   * discarding after every such operation would cause unnecessary reloads in the common case where
   * schemas are unchanged; instead this fetches the cheap schema-identity token via the provider and
   * discards only when it differs from the token stored in the view. If the token cannot be
   * verified, the view is discarded rather than risking stale metadata indefinitely.
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
    // Nothing loaded (reset continuation), or a husk that never fetched a blob and so carries no
    // token - there is nothing worth invalidating.
    if (existing === undefined || existing.schemaToken === "")
      return;
    try {
      const liveToken = await this._dataProvider.fetchSchemaToken();
      if (liveToken === existing.schemaToken || this._viewPromise !== existingPromise)
        return;
    } catch {
      // Cannot verify the cached view is still current: drop it rather than risk returning stale
      // metadata indefinitely. The next getSchemaView call reloads. The guard keeps a concurrent
      // reload's fresh view from being discarded by this stale check.
      if (this._viewPromise !== existingPromise)
        return;
    }
    this.reset();
    // Await the queued teardown so the invalidation (markOutdated + cleared bookkeeping) is fully
    // applied when this method resolves - callers like pullChanges rely on that ordering.
    await this._viewPromise;
  }

  /** Serialized body of {@link getSchemaView}. Waits for the prior load, optionally discards
   * everything (`forceReload`), then ensures the requested schemas (or all schemas, when no filter
   * is given) are present in the single accumulating view. On failure it resets and rejects, so the
   * next call retries from scratch.
   */
  private async _loadSchemaView(previous: Promise<SchemaView | undefined> | undefined, schemas: readonly string[] | undefined, forceReload: boolean): Promise<SchemaView> {
    // Wait for any prior load (or reset) to settle so state transitions stay serialized. A prior
    // failure or reset leaves no usable view, so we simply start over.
    let currentView: SchemaView | undefined;
    if (previous !== undefined) {
      try {
        currentView = await previous;
      } catch {
        currentView = undefined;
      }
    }

    // forceReload throws away whatever is currently loaded and rebuilds from scratch.
    if (forceReload) {
      currentView?.markOutdated();
      currentView = undefined;
      this._resetIncrementalState();
    }

    try {
      return await this._ensureSchemasLoaded(currentView, schemas);
    } catch (err) {
      // Reset so the next call starts clean. We deliberately leave `_viewPromise` pointing at
      // this (now rejected) promise: the next call chains onto it, catches the rejection above, and
      // rebuilds - which also avoids stomping any newer queued load.
      // The current view (if any) is abandoned by that rebuild, so mark it outdated for callers still
      // holding it - a failed merge may even have left it partially extended.
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

  /** The body of {@link getSchemaView}, run serialized behind the accumulating view promise.
   * Ensures the requested schemas (or all schemas, when no filter is given) are present in
   * `currentView` (or a freshly created view when nothing is loaded yet) and returns it.
   *
   * The strategy is fixed by the *first* load:
   *  - First load with no filter -> fetch every schema as one full blob (one round trip, best
   *    cross-schema dedup). The manifest and loaded-name tracking are never needed; `_manifest`
   *    stays `undefined` and all later calls short-circuit.
   *  - First load with a filter -> fetch only the requested schemas and references as a fragment
   *    blob, and keep the manifest + loaded-name set to extend the *same* view on later calls. Once
   *    every schema has been loaded this way, `_manifest` is cleared to collapse back to full mode.
   */
  private async _ensureSchemasLoaded(currentView: SchemaView | undefined, schemas: readonly string[] | undefined): Promise<SchemaView> {
    const isFirstLoad = currentView === undefined;
    // Already satisfied? No manifest means everything is loaded already; incremental mode covers a
    // filtered request as soon as every requested name is present. No I/O, no manifest, no allocation.
    if (!isFirstLoad &&
        (this._manifest === undefined ||
        (schemas !== undefined && schemas.every((name) => this._loadedSchemaNames.has(name.toLowerCase())))))
      return currentView;

    // Full strategy: the very first request wants everything. Fetch the whole iModel as one blob
    // and skip the manifest and closure walk entirely.
    if (isFirstLoad && schemas === undefined) {
      const blob = await this._dataProvider.fetchFullBlob();
      const schemaView = SchemaView.fromBinary(blob.data, blob.schemaToken);
      this._resetIncrementalState(); // full mode: no manifest needed
      return schemaView;
    }

    // Incremental strategy: a filter was given, or the first call established this mode and the
    // caller now wants more. Load the manifest once, then compute the still-missing references and
    // fetch just those schemas as a fragment.
    let manifest = this._manifest;
    if (manifest === undefined)
      manifest = this._manifest = await this._dataProvider.fetchManifest();

    // No filter in incremental mode means "load whatever is left" - the closure of every schema.
    const requested = schemas ?? manifest.getAvailableSchemaNames();
    // The manifest returns the whole reference closure of the request; dropping the already-loaded
    // schemas is our concern, not the manifest's. Fragment load order does not matter (see the writer).
    const namesToLoad = manifest.getSchemaClosure(requested).filter((name) => !this._loadedSchemaNames.has(name.toLowerCase()));
    // Reuse the accumulating view from an earlier incremental load, or start a fresh mergeable husk
    // that later fragments merge into. Either way we return this same instance.
    const husk = currentView ?? SchemaView.createMergeable();
    if (namesToLoad.length > 0) {
      const blob = await this._dataProvider.fetchFragmentBlob(namesToLoad);
      husk.mergeFragment(blob.data);
      husk.setSchemaToken(blob.schemaToken);
      // Record every closure entry as loaded - including *excluded* schemas (e.g. CoreCustomAttributes)
      // that the writer emits no rows for and so never appear in the view. Tracking names (not view
      // contents) is what lets a later request's gate and closure prune them instead of re-fetching.
      for (const name of namesToLoad)
        this._loadedSchemaNames.add(name.toLowerCase());
    }
    // Everything loaded? If yes, collapse the manifest fields which indicates a fully hydrated
    // schema view so future requests hit the fast path above.
    if (schemas === undefined || (this._loadedSchemaNames.size >= manifest.schemaCount && manifest.entries.every((entry) => this._loadedSchemaNames.has(entry.name.toLowerCase()))))
      this._resetIncrementalState();
    return husk;
  }
}
