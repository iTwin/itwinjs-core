---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Quantity formatting](#quantity-formatting)
    - [Bearing and Azimuth formatting now respects the persistence unit's phenomenon](#bearing-and-azimuth-formatting-now-respects-the-persistence-units-phenomenon)
  - [Electron 43 support](#electron-43-support)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)

## Quantity formatting

### Bearing and Azimuth formatting now respects the persistence unit's phenomenon

Previously, [Bearing and Azimuth format types]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) assumed the persisted magnitude was always a true azimuth (measured clockwise from north), regardless of the quantity's `persistenceUnit`. This was incorrect for properties whose `persistenceUnit.phenomenon` is `Units.ANGLE` (a raw mathematical angle, measured counter-clockwise from east) - see [#9465](https://github.com/iTwin/itwinjs-core/issues/9465).

[Formatter.formatQuantity]($quantity) and [Parser.parseQuantityString]($quantity) now branch on `persistenceUnit.phenomenon`:

- `Units.HORIZONTAL_DIRECTION` (a phenomenon; e.g. its `Units.HORIZONTAL_DIR_RAD` unit): unchanged - a `HORIZONTAL_DIRECTION` value is already a true azimuth, so it's formatted/parsed as-is.
- `Units.ANGLE` (a phenomenon; e.g. its `Units.RAD` unit): the `90° − θ` conversion is now applied automatically before formatting an `ANGLE` value, and inverse-applied after parsing one.

For code that persists Bearing/Azimuth values as `ANGLE`-phenomenon units and previously worked around the bug by manually applying its own `90° − θ` correction: **that manual correction must now be removed**, or values will be double-converted. For example, `AccuDraw`'s manual correction for its `QuantityType.Angle` bearing display (persisted as `Units.RAD`) has been removed as part of this change.

If your KindOfQuantity persists true azimuth values directly, switch its persistence unit to a `Units.HORIZONTAL_DIRECTION` unit (e.g. `Units.HORIZONTAL_DIR_RAD`) to opt out of the conversion entirely.

**Note:** if you switch your persistence unit's phenomenon, remember to also update `revolutionUnit` (and `azimuthBaseUnit`, if set) to a unit from the same phenomenon - e.g. `Units.HORIZONTAL_DIR_REVOLUTION` instead of `Units.REVOLUTION` for a `Units.HORIZONTAL_DIRECTION` persistence unit. These units cannot be converted across phenomena, so a mismatch will fail to resolve. See [Bearing and Azimuth Format]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) for details.

## Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).

## @itwin/core-backend

### ChangesetReader.setBatchSize

[ChangesetReader]($backend) now exposes a `setBatchSize(n: number)` method that controls how many change rows are cached in the reader. It is a performance improvement parameter that can be tweaked as per user's choice. Increasing the batch size increases the number of rows read at once and cached in the reader, thereby improving throughput when iterating large changesets but it also increases memory consumption; decreasing it reduces peak memory use. The method must be called before the first [ChangesetReader.step]($backend) call.

Default batch sizes (unchanged behaviour when `setBatchSize` is not called):

| Active configuration | Default |
|---|---|
| `propFilter: InstanceKey` | 100 |
| `propFilter: BisCoreElement` | 20 |
| `propFilter: All`, `abbreviateBlobs: false` | 5 |
| `propFilter: All` (blobs abbreviated or unset) | 10 |

```ts
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setBatchSize(10);
while (reader.step()) { /* ... */ }
```

**Performance improvement with new caching behaviour in ChangesetReader`**:

| Cache type | Inserts | Before (s) | After (s) | Improvement |
|---|---|---|---|---|
| InMemoryCache | 1,000 | 0.220 | 0.204 | 7.3% |
| InMemoryCache | 10,000 | 2.213 | 1.402 | 36.6% |
| SqliteBackedCache | 1,000 | 0.399 | 0.207 | 48.1% |
| SqliteBackedCache | 10,000 | 3.342 | 1.981 | 40.7% |