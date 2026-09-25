---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Download progress for pushChanges](#download-progress-for-pushchanges)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
    - [Experimental `Relations()` table valued function](#experimental-relations-table-valued-function)
    - [Import CSV data into ECDb](#import-csv-data-into-ecdb)
    - [ChangesetReader changes](#changesetreader-changes)
      - [ChangesetReader row options](#changesetreader-row-options)
      - [SQLite changeset schema sources](#sqlite-changeset-schema-sources)
  - [@itwin/core-electron](#itwincore-electron)
    - [Process-specific Electron ESM/CommonJS entry points](#process-specific-electron-esmcommonjs-entry-points)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [`PlanarRegionProps` refactor](#planarregionprops-refactor)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-frontend

### Download progress for pushChanges

Pushing local changes first pulls, applies, and merges any changesets made by other users. That download could not previously be observed or cancelled. A new `@beta` overload of [BriefcaseConnection.pushChanges]($frontend) accepts [PushChangesOptions]($frontend), mirroring the options already available on [BriefcaseConnection.pullChanges]($frontend):

```ts
const abortSignal = new AbortController();
await briefcase.pushChanges("my changes", {
  downloadProgressCallback: (progress) => console.log(`${progress.loaded} of ${progress.total} bytes`),
  downloadProgressInterval: 500,
  abortSignal: abortSignal.signal,
});
```

Aborting rejects the returned promise and leaves the local changes pending, so the push can be retried later.

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

### Experimental `Relations()` table valued function

ECSQL gains a new **experimental** table valued function, `ECVLib.Relations()`, that returns every instance directly related to a seed instance without the caller having to know which relationships apply to it. Its native traversal generates SQL from property maps and reads relationship storage directly, avoiding ECSQL preparation for each candidate relationship class. The outer query still goes through ECSQL preparation.

```sql
ECVLib.Relations(<ECInstanceId>, <ECClassId>[, <direction>])
```

The `ECInstanceId` and `ECClassId` arguments are mandatory; a query that omits either is rejected rather than silently returning no rows. The optional third argument is the traversal direction — `'forward'`, `'backward'` or `'both'` (the default, also used when the argument is `NULL`). The comparison is case insensitive; any other value is an error. The function may also be written unqualified as `Relations(...)`.

Each row describes one traversed relationship:

| Column                     | Description                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `RelatedECInstanceId`      | `ECInstanceId` of the related instance.                                                                                          |
| `RelatedECClassId`         | `ECClassId` of the related instance.                                                                                             |
| `Direction`                | `forward` when the seed is the source of the relationship, `backward` when it is the target.                                      |
| `RelationshipECClassId`    | `ECClassId` of the relationship that was traversed.                                                                              |
| `RelationshipECInstanceId` | `ECInstanceId` of the relationship instance, which distinguishes two link table rows connecting the same pair of instances.       |
| `NavPropertyName`          | Name of the navigation property holding the relationship for end table (foreign key) relationships; `NULL` for link tables.       |

Because `Relations()` is experimental it is disabled by default. Enable it with `PRAGMA experimental_features_enabled=true` or per query with `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`.

**Example** — find the model that contains an element, without knowing that `BisCore:ModelContainsElements` is stored in the `Model` navigation property:

```sql
SELECT r.RelatedECInstanceId
FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'backward') r
  JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId
WHERE e.ECInstanceId = :elementId AND rc.Name = 'ModelContainsElements'
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

Only instances of the primary (`main`) table space are traversed, and the ECSQL version was bumped to `2.0.4.1`.

See the [Relations virtual table reference](../learning/ECSqlReference/Relations.md) for more details.

### Import CSV data into ECDb

CSV data can be imported into an ECClass from in-memory string rows or streamed from a file. Both beta APIs return the number of inserted rows:

```ts
const options = {
  className: "Example.Person",
  mapping: [
    { columnIndex: 0, propertyName: "Name" },
    { columnIndex: 1, propertyName: "Age" },
  ],
};

ecdb.importCSVData([["Alice", "42"], ["Bob", "37"]], options);
ecdb.importCSVFile(csvFilePath, { ...options, hasHeader: true });
```

[ECDb.importCSVData]($backend) uses V8 serialization to cross the JavaScript-to-native boundary once. [ECDb.importCSVFile]($backend) reads and parses the file in native code; its path must be accessible to the backend process. Both reuse one ECSQL statement, convert each CSV string according to its mapped EC property type, ignore unmapped columns, and roll back the complete import if parsing, conversion, or insertion fails.

### ChangesetReader changes

#### ChangesetReader row options

The `useJsName` option has been deprecated in the `@beta` `RowFormatOptions` used by [ChangesetReader]($backend). Use `classIdsToClassNames` to resolve class Id values to fully-qualified class names.

#### SQLite changeset schema sources

The `@beta` `SqliteChangesetReader.openFile` method now accepts a plain `SQLiteDb` as its source of table and column metadata. The database must be open and contain every table referenced by the changeset. Set `disableSchemaCheck` to tolerate changeset columns that are not present in the database. A missing table always produces an error for every database type; `disableSchemaCheck` does not relax this requirement. EC-specific consumers such as `ChangesetECAdaptor` continue to require an `IModelDb` or `ECDb`.

## @itwin/core-electron

### Process-specific Electron ESM/CommonJS entry points

Use the process-specific entry points when importing from `@itwin/core-electron`:

```ts
import { ElectronApp } from "@itwin/core-electron/renderer";
import { ElectronHost } from "@itwin/core-electron/main";
```

For CommonJS applications, use the same entry-point paths with `require`:

```js
const { ElectronApp } = require("@itwin/core-electron/renderer");
const { ElectronHost } = require("@itwin/core-electron/main");
```

`renderer` resolves to the ESM build for `import` and to the CommonJS build for `require`. `main` resolves to the CommonJS build for both. The package now uses an exports map, so subpaths that are not listed are not supported; in particular, `lib/esm/*` paths and `ElectronPreload` are not public package entry points. The existing `@itwin/core-electron/lib/cjs/*` wildcard paths remain available in this release for compatibility with legacy consumers and will be removed in iTwin.js 6.0. New code should use the process-specific entry points. The Electron preload script remains an internal implementation detail configured by `ElectronHost`.

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
