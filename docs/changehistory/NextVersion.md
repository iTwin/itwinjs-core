---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Electron 43 support](#electron-43-support)
  - [SchemaSync schema-import id reservation](#schemasync-schema-import-id-reservation)

## Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).

## SchemaSync schema-import id reservation

A new `@beta` API, [SharedSchemaReservations]($backend), allows briefcases that use [SchemaSync]($backend) to pre-reserve disjoint `ec_*` metadata id ranges for a specific schema version *while online*, then import that schema *offline* without id collisions when changesets are later merged.

**Usage:**

```ts
// 1. While online, reserve id ranges for the schema you intend to import.
const identity: SchemaImportIdentity = {
  schemaName: "MyDomain",
  versionMajor: 1,
  versionMinor: 0,
  versionPatch: 0,
};

if (db.schemaReservations.needsSchemaReservation(identity))
  await db.schemaReservations.reserveSchemaImport(identity);

// 2. Later (including offline), import the schema and supply the reservation identity.
await db.importSchemas([schemaFilePath], { schemaReservationIdentity: identity });
```

The reservation is idempotent: calling `reserveSchemaImport` twice for the same identity with the same native dry-run counts returns the existing ranges without advancing the shared counter. A `SchemaImportReservationError` is thrown if the same identity is reserved with conflicting id counts (a sign that two callers are proposing different schema content under the same version).

Access the control object via [IModelDb.schemaReservations]($backend). Supply the reserved schema identity to [importSchemas]($backend) (or [importSchemaStrings]($backend)) via `SchemaImportOptions.schemaReservationIdentity`.

