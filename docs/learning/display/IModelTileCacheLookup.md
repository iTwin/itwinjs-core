# iModel tile external-cache lookup

This note documents the frontend request path for iModel tiles. It does not
apply to reality models, map tiles, or 3D Tiles.

## Explicit application control

An application can skip the initial external tile-storage lookup when its
backend does not use external tile storage:

```ts
await IModelApp.startup({
  tileAdmin: {
    enableExternalTileCacheLookup: false,
  },
});
```

The default remains `true` for compatibility. The setting is independent of
the RPC transport, IPC, and whether the iModel is local.

This setting controls only the initial lookup. If a cache-enabled backend
generates a tile, uploads it, and returns `TileContentSource.ExternalCache`,
the frontend still downloads that generated tile from external storage.

## Request path

For a newly requested `IModelTile`:

1. The tile initially selects the optional metadata cache, then the external
   `CloudStorageCacheChannel`, then RPC.
2. The cloud channel calls `TileAdmin.requestCachedTileContent`.
3. `TileStorage` obtains and caches the backend transfer configuration. If the
   backend has no external tile storage, this configuration is `undefined` and
   no object-storage download is issued.
4. The cache channel reports a miss and changes the tile's request channel to
   RPC.
5. The tile is processed again through RPC, producing the backend-generated
   content.

Thus, when external storage is unavailable, lookup-on produces one cache
dispatch and one RPC dispatch for each newly requested tile. Lookup-off selects
RPC immediately and produces one dispatch. After a tile misses once, its
`requestChannel` remains RPC for the lifetime of that tile object.

## Automated coverage

`TileRequestChannels.test.ts` verifies:

- The option enables or disables the cloud channel for both HTTP and IPC.
- Every newly requested tile performs the lookup when enabled.
- A real tile request retries through RPC after a cache miss.

`TileStorage.test.ts` verifies that an undefined transfer configuration is
cached per iModel and prevents object-storage downloads.

## Reproducing the performance impact

The display performance test app already waits for
`viewport.waitForSceneCompletion()` and records tile-loading time. Its CSV
also includes:

- `Tile Cache Misses`
- `Tile Dispatched Requests`
- `Tile Completed Requests`

Run the same saved views in two fresh Electron processes, changing only
`tileProps.enableExternalTileCacheLookup`:

```json
{
  "outputName": "tile-load.csv",
  "outputPath": "/tmp/tile-load",
  "iModelLocation": "/absolute/path/to/models",
  "iModelName": "model.bim",
  "view": { "width": 1200, "height": 800 },
  "numRendersToSkip": 10,
  "numRendersToTime": 10,
  "testSet": [
    {
      "tileProps": {
        "enableExternalTileCacheLookup": true
      },
      "tests": [
        { "viewName": "Floor B1" },
        { "viewName": "Overview" }
      ]
    }
  ]
}
```

Repeat with the option set to `false`. Use separate processes so renderer and
`TileAdmin` state do not carry between variants. A persistent native tile cache
is acceptable because it is shared by both variants; the comparison concerns
the extra frontend cache lookup and retry.

For a backend without external tile storage, lookup-on should show one cache
miss and two dispatched requests per completed tile. Lookup-off should show no
cache misses and one dispatched request per completed tile.
