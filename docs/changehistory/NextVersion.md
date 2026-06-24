---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)
  - [@itwin/map-layers-formats](#itwinmap-layers-formats)
    - [Azure Maps basemap support is available through map-layers-formats](#azure-maps-basemap-support-is-available-through-map-layers-formats)

## @itwin/core-backend

### ChangesetReader.setBatchSize

[ChangesetReader]($backend) now exposes a `setBatchSize(n: number)` method that controls how many change rows are cached in the reader. It is a performance improvement parameter that can be tweaked as per user's choice. Increasing the batch size increases the number of rows read at once and cached in the reader, thereby improving throughput when iterating large changesets but it also increases memory consumption; decreasing it reduces peak memory use. The method must be called before the first [ChangesetReader.step]($backend) call.

Default batch sizes (unchanged behaviour when `setBatchSize` is not called):

| Active configuration | Default |
|---|---|
| `propFilter: InstanceKey` | 100 |
| `propFilter: All` or `BisCoreElement`, `abbreviateBlobs: false` | 5 |
| `propFilter: All` or `BisCoreElement` (other cases) | 25 |

```ts
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setBatchSize(10);
while (reader.step()) { /* ... */ }
```

## @itwin/map-layers-formats

### Azure Maps basemap support is available through map-layers-formats

`@itwin/map-layers-formats` now registers Azure Maps imagery support through `MapLayersFormats.initialize()` and exposes a beta `AzureMaps` helper for applying Azure Maps Street, Aerial, and Hybrid basemaps.

Applications configure the Azure Maps key when initializing `@itwin/map-layers-formats` with `MapLayersFormats.initialize({ azureMapsOpts: { subscriptionKey: ... } })`. After initializing `@itwin/map-layers-formats`, code that wants Azure-specific basemap helpers can import `AzureMaps` from that package.
