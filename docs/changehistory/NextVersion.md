---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [`PlanarRegionProps` refactor](#planarregionprops-refactor)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

## @itwin/core-geometry

### `PlanarRegionProps` refactor

The flag `Loop.isInner` did not always survive round-trip through JSON or FlatBuffers due to an oversight. To address this, the `CurveCollection` class and `PlanarRegionProps` schema have been slightly refactored.

`CurveCollection.isInner` is now moved to `Loop.isInner` since `Loop` is the only subclass of `CurveCollection` for which this flag is relevant. As this flag is a) only set by user code, b) does not effect region processing, and c) was previously accessible to `Loop` by virtue of inheritance, this should not break existing code.

The JSON schema `IModelJson.PlanarRegionProps` has been refactored to extend 3 new interfaces: `LoopProps` (which includes `isInner`), `ParityRegionProps`, and `UnionProps`. This has 3 effects:
  - `PlanarRegionProps.isInner` is a new optional property. In concert with the existing `PlanarRegionProps.loop` property, a `ParityRegionProps` can now specify a `Loop` that has been marked "inner" by the user.
  - `PlanarRegionProps.parityRegion` is now an array of `LoopProps`, thus each of its entries now inherits the `isInner` property, allowing the specification of the common solid-with-holes type of parity region.
  - `PlanarRegionProps.unionRegion` is now an array of `LoopProps | ParityRegionProps`, which explicitly disallows illegal nested `UnionRegion`s. Previously, this property could specify a nested union because it was an array of `PlanarRegionProps`. Regions code consistently assumes that `UnionRegion`s are not nested for efficiency.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).

