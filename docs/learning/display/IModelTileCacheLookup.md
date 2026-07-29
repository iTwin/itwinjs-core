# IModel tile external-cache lookup

This note documents the frontend request path for iModel tiles. It does not apply
to reality models, map tiles, or 3D Tiles.

## Explicit application control

An application can decide whether to query external tile storage before asking
its backend to generate an iModel tile:

```ts
await IModelApp.startup({
  tileAdmin: {
    enableExternalTileCacheLookup: false,
  },
});
```

The default is `true` for compatibility. The setting is not inferred from the
RPC transport, the presence of IPC, or whether the iModel is local.
After startup, an application can inspect the effective value through
`IModelApp.tileAdmin.enableExternalTileCacheLookup`.

This setting controls the initial cache lookup only. If a cache-enabled backend
generates a tile, uploads it, and returns `TileContentSource.ExternalCache`, the
frontend still downloads that generated tile from external storage.

## Request path when lookup is enabled

The following path applies to each newly requested `IModelTile`:

1. [`IModelTile.channel`](../../../core/frontend/src/internal/tile/IModelTile.ts)
   calls `TileRequestChannels.getIModelTileChannel`.
2. [`TileRequestChannels.getIModelTileChannel`](../../../core/frontend/src/tile/TileRequestChannels.ts)
   calls `IModelTileRequestChannels.getChannelForTile`.
3. For a new tile, `IModelTile.requestChannel` is undefined. Unless the
   specialized metadata cache supplies content,
   [`getChannelForTile`](../../../core/frontend/src/internal/tile/IModelTileRequestChannels.ts)
   returns the `CloudStorageCacheChannel`.
4. The [`TileRequest`](../../../core/frontend/src/tile/TileRequest.ts)
   constructor captures that channel. When the channel dispatches the request,
   [`TileRequestChannel.dispatch`](../../../core/frontend/src/tile/TileRequestChannel.ts)
   increments `totalDispatchedRequests`.
5. `TileRequest.dispatch` calls `CloudStorageCacheChannel.requestContent`, which
   unconditionally calls
   [`TileAdmin.requestCachedTileContent`](../../../core/frontend/src/tile/TileAdmin.ts)
   for that tile.
6. `TileAdmin.requestCachedTileContent` calls
   [`TileStorage.downloadTile`](../../../core/frontend/src/tile/TileStorage.ts).
7. `TileStorage.downloadTile` obtains the backend's transfer configuration
   through
   [`IModelTileRpcInterface.getTileCacheConfig`](../../../core/common/src/rpc/IModelTileRpcInterface.ts)
   and, if one exists, calls the configured `FrontendStorage.download`.
8. When no cached content is returned,
   `CloudStorageCacheChannel.onNoContent` assigns the RPC channel to
   `tile.requestChannel`, increments `totalCacheMisses`, and permits a retry.
9. `TileRequest.dispatch` clears the failed request without marking the tile as
   permanently unavailable. When the tile is selected again, a new
   `TileRequest` captures the RPC channel and dispatches the backend generation
   request.

Therefore, a tile that misses external storage produces two frontend tile
dispatches: one external-cache dispatch and one backend dispatch. The cache
channel is checked once for every new tile, not only for the first tile.
After that tile's miss, its `requestChannel` remains set to RPC, so a later
reload of the same in-memory tile object does not repeat the external lookup.

There is an important network distinction. `TileStorage` caches the transfer
configuration, including an `undefined` response. A backend with no external
tile storage receives one `getTileCacheConfig` RPC per iModel, not one per tile.
Every tile still enters `CloudStorageCacheChannel`, calls
`requestCachedTileContent` and `downloadTile`, records a miss, and waits for a
later processing pass to dispatch through RPC. It does not issue an object
storage download when no transfer configuration exists.

With `enableExternalTileCacheLookup: false`, the cloud channel is not created.
`IModelTileRequestChannels.getChannelForTile` selects RPC for the first request,
so the same cache miss produces one frontend dispatch instead of two.

## Automated proof

[`TileRequestChannels.test.ts`](../../../core/frontend/src/test/tile/TileRequestChannels.test.ts)
verifies both claims:

- The option enables or disables the cloud channel for both HTTP RPC and IPC.
  Transport selection does not affect the result.
- Seven distinct `IModelTile` objects are passed through the real
  `IModelTile.channel` getter. A spy on `TileAdmin.requestCachedTileContent`
  receives seven calls with the same seven tile objects. This guards against an
  implementation that checks only the first tile or only the first request for
  an iModel.

## Electron measurement

The display-test-app was measured against a local `outrigger-skyscraper.bim`
with no external tile cache. Each variant used the same fixed close oblique
camera, models, categories, viewport, tile settings, persistent native tile
cache, tile IDs, and byte counts. Each row below was repeated five times.
Frontend tile trees were cleared before each run, so each run created new
`IModelTile` objects and exercised their first content requests.

The 22–25% reduction measured below therefore applies to cold or recreated
frontend tile trees. It does not apply to a later request for the same surviving
tile object: after that object's first cache miss, its `requestChannel` remains
set to RPC and bypasses the cache channel. Newly created tiles encountered
during navigation still pay the lookup-on overhead once each.

| Inspection pose | Completed tiles per run | Lookup-on cache misses | Lookup-on dispatches | Lookup-off cache misses | Lookup-off dispatches |
|---|---:|---:|---:|---:|---:|
| Structural close-up | 15 | 15 | 30 | 0 | 15 |
| Opposite-facade detail | 12 | 12 | 24 | 0 | 12 |
| Curtain-wall detail | 23 | 23 | 46 | 0 | 23 |

Across the 15 lookup-on runs, 250 completed tiles produced 250 cache misses and
500 dispatches. Across the 15 lookup-off runs, the same 250 tiles produced no
cache misses and 250 dispatches. These values come from the existing
`TileAdmin.statistics.totalCacheMisses`,
`TileAdmin.statistics.totalDispatchedRequests`, and
`TileAdmin.statistics.totalCompletedRequests` counters.

The corresponding median completion times were:

| Inspection pose | Lookup on | Lookup off | Reduction |
|---|---:|---:|---:|
| Structural close-up | 150.1 ms | 116.1 ms | 22.7% |
| Opposite-facade detail | 149.3 ms | 116.0 ms | 22.3% |
| Curtain-wall detail | 199.1 ms | 149.5 ms | 24.9% |

The dispatch counts prove that the initial cache path runs for every requested
tile in these workloads. The timing result shows the cost of the extra
frontend dispatch/retry path; it should not be described as one network request
per tile when the backend has already reported that no external cache exists.

## Reproducing the comparison in display-test-app

The display-test-app exposes the same option through
`IMJS_EXTERNAL_TILE_CACHE_LOOKUP`.

Run the lookup-on variant:

```sh
IMJS_EXTERNAL_TILE_CACHE_LOOKUP=true \
IMJS_STANDALONE_FILENAME=/absolute/path/to/model.bim \
rushx start
```

Run the lookup-off variant:

```sh
IMJS_EXTERNAL_TILE_CACHE_LOOKUP=false \
IMJS_STANDALONE_FILENAME=/absolute/path/to/model.bim \
rushx start
```

Use the same saved view and viewport size for both runs. After tile loading
settles, capture these existing counters from `IModelApp.tileAdmin.statistics`:

```ts
const {
  totalCacheMisses,
  totalCompletedRequests,
  totalDispatchedRequests,
} = IModelApp.tileAdmin.statistics;
```

For a backend without external tile storage, lookup-on should report one cache
miss and two dispatches per completed tile. Lookup-off should report no cache
misses and one dispatch per completed tile.
