---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
    - [Experimental `Relations()` table valued function](#experimental-relations-table-valued-function)
    - [ChangesetReader changes](#changesetreader-changes)
      - [ChangesetReader row options](#changesetreader-row-options)
      - [ChangeInstance ECInstanceId and ECClassId](#changeinstance-ecinstanceid-and-ecclassid)
  - [Electron 44 support](#electron-44-support)

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

### ChangesetReader changes

#### ChangesetReader row options

The `useJsName` option has been deprecated in the `@beta` `RowFormatOptions` used by [ChangesetReader]($backend). Use `classIdsToClassNames` to resolve class Id values to fully-qualified class names.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
