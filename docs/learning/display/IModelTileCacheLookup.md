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

## Measuring the performance impact

Use the A/B harness in the display performance test app:

```sh
cd test-apps/display-performance-test-app
node scripts/ab-tile-cache-lookup.mjs \
  --iModelLocation /absolute/path/to/models \
  --iModelName model.bim \
  --views "Floor B1,Overview,Section AA" \
  --reps 5
```

It runs the same saved views with `tileProps.enableExternalTileCacheLookup` set
to `true` and `false`, and reports median tile-loading time, interquartile
range, and the request counts from the CSV columns `Tile Cache Misses`,
`Tile Dispatched Requests`, and `Tile Completed Requests`.

Three controls in the harness are necessary; without them the measurement is
dominated by unrelated effects:

- **Warm-up runs.** The backend keeps a persistent native tile cache beside the
  iModel (`<model>.bim.Tiles`). Whichever variant runs first against a cold
  cache pays for tile *generation*, which is much larger than the effect being
  measured. The harness performs a discarded run of each variant first so that
  generation cost is constant across all measured runs.
- **Order balancing.** Runs alternate ABBA across repetitions so run order
  cannot systematically favor either variant.
- **A fresh process per run.** Frontend tile trees and `TileAdmin` state must
  not carry between runs: a tile already resident is never re-requested, and a
  tile that has missed once keeps the RPC channel for the rest of its lifetime.

Because the tile cache is pre-warmed, the results describe a steady-state
backend rather than a user's first-ever open of a model. That isolates the cost
of the redundant lookup, but on a genuinely cold backend the same overhead is a
smaller fraction of a much larger total.

## Observed results

The request counts are exact and reproduce on every run. For a backend without
external tile storage, lookup-on performs one cache miss and two dispatched
requests per completed tile; lookup-off performs no cache misses and one
dispatched request per completed tile. The `Tile Completed Requests` count is
identical for both variants, which confirms both performed the same frontend
work and only the dispatch count differed.

Timing impact is workload-dependent and only becomes significant when a view
requests many new tiles. Medians of five order-balanced repetitions on an
Apple M1 Pro, against local snapshots with no external tile storage configured:

| iModel | Saved view | New tiles | Lookup on | Lookup off | Delta |
|---|---|---:|---:|---:|---:|
| MetroStation | Floor B1 | 437 | 8,523 ms | 5,449 ms | +3,074 ms (36%) |
| MetroStation | Overview | 49 | 742 ms | 641 ms | +101 ms (14%) |
| MetroStation | Section AA | 79 | 1,044 ms | 952 ms | +92 ms (9%) |
| MetroStation | Isometric | 82 | 989 ms | 890 ms | +99 ms (10%) |
| MetroStation | Design Model | 50 | 743 ms | 743 ms | 0 ms |
| Stadium | 3D Metric Design - View 1 | 24 | 1,313 ms | 1,224 ms | +89 ms (7%) |
| Stadium | 3D Metric Design - View 2 | 52 | 1,819 ms | 2,032 ms | -213 ms |
| Stadium | Standardized View | 22 | 729 ms | 743 ms | -14 ms |
| Stadium | Default - View 1 | 1 | 307 ms | 308 ms | -1 ms |

The overhead is not a fixed per-tile cost. It is negligible or within noise
below roughly one hundred new tiles, and becomes substantial for tile-heavy
views, which suggests contention once the number of queued tiles greatly
exceeds the channel concurrency limit rather than a constant cost per lookup.

Measurements taken without the controls described above can overstate the
effect by an order of magnitude, because they attribute first-run backend tile
generation to the variant that happened to run first.
