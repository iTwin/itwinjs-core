# Geometry Stream ECSQL Functions

iTwin.js exposes a set of built-in ECSQL functions for inspecting geometry streams stored on `BisCore.GeometricElement` and `BisCore.GeometryPart` instances. These functions allow you to decompose, count, classify, and convert geometry blobs entirely within an ECSQL query — no element load or round-trip to TypeScript code required.

> **Backend only — synchronous reader required.** All geometry stream functions rely on the native layer and are **only available on the backend**. They must be used with [IModelDb.withQueryReader]($backend) (or [ECDb.withQueryReader]($backend)), which provides [synchronous row-by-row execution](./WithQueryReaderCodeExamples.md). They are **not available** through the async `createECsqlReader` / [IModelConnection.createQueryReader]($frontend) path used in frontend or agent code.

> **Experimental feature flag required.** Queries that use the `imodel_geom_stream` virtual table must include the `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` clause. The scalar functions (`imodel_geom_json`, `imodel_geom_entry_count`, `imodel_geom_has_brep`, `imodel_geom_part_ids`) do not require this flag.

> **50 MB size limit — silent skip, not an error.** By default, any geometry stream whose uncompressed size exceeds **50 MB** is silently ignored by all geometry stream functions. `imodel_geom_stream` returns zero rows for that element, and the scalar functions return `NULL`. No exception is thrown and the query continues normally with remaining rows. If you are working with unusually large geometry streams and expect empty results, check whether the stream size exceeds this limit. The limit can be raised via [IModelHostConfiguration.maxGeomStreamVTabBytes]($backend) at startup or read at runtime with [IModelHost.maxGeomStreamVTabBytes]($backend).

See also:

- [withQueryReader Code Examples](./WithQueryReaderCodeExamples.md) — how to use the synchronous reader required by these functions
- [Executing ECSQL in the Backend](./ExecutingECSQL.md)

---

## Overview of Available Functions

| Function | Type | Input | Returns |
|---|---|---|---|
| [`imodel_geom_stream(blob)`](#imodel_geom_stream) | Virtual table | `GeometryStream` column | One row per geometry entry |
| [`imodel_geom_json(blob)`](#imodel_geom_json) | Scalar | `GeometryBlob` column from vtab | iTwin.js JSON string, or `NULL` for BRep |
| [`imodel_geom_entry_count(blob)`](#imodel_geom_entry_count) | Scalar | `GeometryStream` column | `INTEGER` — total primitive count |
| [`imodel_geom_has_brep(blob)`](#imodel_geom_has_brep) | Scalar | `GeometryStream` column | `0` or `1` |
| [`imodel_geom_part_ids(blob)`](#imodel_geom_part_ids) | Scalar | `GeometryStream` column | JSON array of hex IDs, or `NULL` |

---

## `imodel_geom_stream`

`imodel_geom_stream` is a **virtual table function** (table-valued function). It takes the raw `GeometryStream` blob from a geometric element or geometry part and yields one row for every entry in that stream — geometry primitives, symbology changes, part references, and so on.

### Columns

| Column | Type | Description |
|---|---|---|
| `EntryIndex` | `INTEGER` | Zero-based position of this entry within the stream |
| `OpCode` | `TEXT` | Opcode name identifying the kind of entry |
| `EntryType` | `TEXT` | Human-readable entry type label |
| `IsGeometry` | `INTEGER` | `1` if this row represents a geometry primitive, `0` otherwise |
| `SubCategoryId` | `TEXT` | Active sub-category ID at this entry (may be `NULL`) |
| `Color` | `INTEGER` | Overridden color value (may be `NULL`) |
| `Weight` | `INTEGER` | Line weight override (may be `NULL`) |
| `GeomClass` | `TEXT` | Geometry class (e.g. `Primary`, `Construction`) |
| `RangeLowX/Y/Z` | `REAL` | Low corner of the per-entry bounding box (from `SubGraphicRange` opcodes; `NULL` for simple primitives) |
| `RangeHighX/Y/Z` | `REAL` | High corner of the per-entry bounding box (from `SubGraphicRange` opcodes; `NULL` for simple primitives) |
| `HeaderFlags` | `INTEGER` | Raw stream header flags |
| `GeometryPartId` | `TEXT` | Element ID of the referenced `GeometryPart` (only for part-reference rows) |
| `PartOriginX/Y/Z` | `REAL` | Placement origin of the part instance |
| `TextContent` | `TEXT` | Text string (only for text annotation entries) |
| `GeometryBlob` | `BLOB` | Flatbuffer-encoded representation of this individual geometry primitive. Pass to `imodel_geom_json()` to convert it to JSON. |

### Example: Inspect every entry in an element's geometry stream

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function inspectGeometryStream(iModel: IModelDb, elementId: string) {
  const ecsql = `
    SELECT gs.EntryIndex, gs.OpCode, gs.EntryType, gs.IsGeometry,
           gs.SubCategoryId, gs.Weight, gs.GeomClass,
           gs.GeometryPartId, gs.GeometryBlob
    FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
    WHERE e.ECInstanceId = ?
    ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

  iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => {
      for (const row of reader) {
        console.log(`[${row[0]}] opCode=${row[1]} isGeometry=${row[4]}`);
      }
    },
    new QueryBinder().bindId(1, elementId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

### Example: Collect only geometry rows

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function getGeometryRows(iModel: IModelDb, elementId: string) {
  const ecsql = `
    SELECT gs.EntryIndex, gs.IsGeometry, gs.GeomClass, gs.GeometryBlob
    FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
    WHERE e.ECInstanceId = ? AND gs.IsGeometry = 1
    ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

  return iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    new QueryBinder().bindId(1, elementId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

### Example: Decompose a `GeometryPart`'s stream

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function inspectGeometryPart(iModel: IModelDb, partId: string) {
  const ecsql = `
    SELECT gs.EntryIndex, gs.OpCode, gs.IsGeometry, gs.GeometryBlob
    FROM BisCore.GeometryPart p, imodel_geom_stream(p.GeometryStream) gs
    WHERE p.ECInstanceId = ?
    ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

  return iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    new QueryBinder().bindId(1, partId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

### Size limit and `maxGeomStreamVTabBytes`

See the [50 MB size limit callout](#geometry-stream-ecsql-functions) at the top of this page. The native layer enforces a minimum of **4 KB** when overriding the limit; values below that are clamped automatically.

---

## `imodel_geom_json`

`imodel_geom_json` is a **scalar function** that converts a single geometry primitive blob (the `GeometryBlob` column from `imodel_geom_stream`) into the iTwin.js geometry JSON format. The returned string can be `JSON.parse`d into a JavaScript object and used with `@itwin/core-geometry`.

Returns `NULL` for BRep geometry entries (BReps are not representable in the portable JSON format).

### Signature

```sql
imodel_geom_json(GeometryBlob) -> TEXT | NULL
```

### Example: Convert geometry blobs to iTwin.js JSON

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function getGeometryJson(iModel: IModelDb, elementId: string) {
  const ecsql = `
    SELECT imodel_geom_json(gs.GeometryBlob) AS geomJson, gs.EntryType
    FROM BisCore.GeometricElement3d e, imodel_geom_stream(e.GeometryStream) gs
    WHERE e.ECInstanceId = ? AND gs.IsGeometry = 1
    ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`;

  return iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) =>
      reader.toArray().map((row) => ({
        entryType: row.entryType as string,
        // geomJson is NULL for BRep entries
        geometry: row.geomJson != null ? JSON.parse(row.geomJson as string) : null,
      })),
    new QueryBinder().bindId(1, elementId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

For an arc, the parsed JSON will have the shape:

```json
{
  "arc": {
    "center": { "x": 0, "y": 0, "z": 0 },
    "vectorX": { "x": 5, "y": 0, "z": 0 },
    "vectorY": { "x": 0, "y": 5, "z": 0 },
    "sweepStartEnd": [0, 360]
  }
}
```

---

## `imodel_geom_entry_count`

`imodel_geom_entry_count` is a **scalar function** that returns the total number of geometry primitive entries in a raw `GeometryStream` blob. It operates on the full stream column directly — no join with `imodel_geom_stream` is needed.

Use this for lightweight filtering or sorting without deserializing the whole stream.

### Signature

```sql
imodel_geom_entry_count(GeometryStream) -> INTEGER
```

### Example: Filter elements with more than one geometry primitive

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryRowFormat } from "@itwin/core-common";

function findElementsWithMultipleGeometries(iModel: IModelDb) {
  const ecsql = `
    SELECT e.ECInstanceId, imodel_geom_entry_count(e.GeometryStream) AS cnt
    FROM BisCore.GeometricElement3d e
    WHERE cnt > 1`;

  return iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    undefined,
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

### Example: Cross-check entry count with the vtab

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function verifyEntryCount(iModel: IModelDb, elementId: string): number {
  const ecsql = `
    SELECT imodel_geom_entry_count(e.GeometryStream) AS cnt
    FROM BisCore.GeometricElement3d e
    WHERE e.ECInstanceId = ?`;

  const [row] = iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    new QueryBinder().bindId(1, elementId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );

  return row.cnt as number;
}
```

---

## `imodel_geom_has_brep`

`imodel_geom_has_brep` is a **scalar function** that scans a `GeometryStream` blob and returns `1` if the stream contains at least one BRep geometry entry, or `0` otherwise. It never returns `NULL` for a valid stream.

BRep geometry (Boundary Representation) requires a separate extraction step and cannot be converted to portable JSON. Use this function to quickly identify elements that contain BRep data before deciding how to process them.

### Signature

```sql
imodel_geom_has_brep(GeometryStream) -> INTEGER  -- 0 or 1
```

### Example: Separate BRep elements from non-BRep elements

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryRowFormat } from "@itwin/core-common";

function partitionByBRep(iModel: IModelDb) {
  const ecsql = `
    SELECT e.ECInstanceId, imodel_geom_has_brep(e.GeometryStream) AS hasBrep
    FROM BisCore.GeometricElement3d e`;

  const rows = iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    undefined,
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );

  const brepIds = rows.filter((r) => r.hasBrep === 1).map((r) => r.ecInstanceId as string);
  const plainIds = rows.filter((r) => r.hasBrep === 0).map((r) => r.ecInstanceId as string);
  return { brepIds, plainIds };
}
```

### Example: Count BRep vs non-BRep elements

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryRowFormat } from "@itwin/core-common";

function countBRepElements(iModel: IModelDb) {
  const ecsql = `
    SELECT SUM(imodel_geom_has_brep(e.GeometryStream)) AS brepCount,
           COUNT(*) - SUM(imodel_geom_has_brep(e.GeometryStream)) AS plainCount
    FROM BisCore.GeometricElement3d e`;

  const [row] = iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    undefined,
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );

  return { brepCount: row.brepCount as number, plainCount: row.plainCount as number };
}
```

---

## `imodel_geom_part_ids`

`imodel_geom_part_ids` is a **scalar function** that scans a `GeometryStream` blob and returns a JSON array containing the element IDs (as hex strings, e.g. `"0x1a"`) of all `GeometryPart` instances referenced by the stream. Returns `NULL` if the stream contains no part references.

Use this to find all elements that depend on a given part (for example, when planning to delete or modify a part).

### Signature

```sql
imodel_geom_part_ids(GeometryStream) -> TEXT | NULL  -- JSON array of hex IDs
```

### Example: Get all part IDs referenced by an element

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function getReferencedPartIds(iModel: IModelDb, elementId: string): string[] {
  const ecsql = `
    SELECT imodel_geom_part_ids(e.GeometryStream) AS partIds
    FROM BisCore.GeometricElement3d e
    WHERE e.ECInstanceId = ?`;

  const [row] = iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) => reader.toArray(),
    new QueryBinder().bindId(1, elementId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );

  if (row.partIds == null)
    return [];

  return JSON.parse(row.partIds as string) as string[];
}
```

### Example: Find all elements that reference a specific part

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";

function findElementsReferencingPart(iModel: IModelDb, partId: string): string[] {
  // imodel_geom_part_ids returns a JSON array; use json_each to join against it
  const ecsql = `
    SELECT e.ECInstanceId
    FROM BisCore.GeometricElement3d e, json_each(imodel_geom_part_ids(e.GeometryStream)) ref
    WHERE imodel_geom_part_ids(e.GeometryStream) IS NOT NULL
      AND ref.value = ?`;

  return iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) =>
      reader.toArray().map((r) => r.ecInstanceId as string),
    new QueryBinder().bindString(1, partId),
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

### Example: Find all elements referencing multiple parts

```typescript
import { ECSqlSyncReader, IModelDb } from "@itwin/core-backend";
import { QueryRowFormat } from "@itwin/core-common";

function findElementsWithPartReferences(iModel: IModelDb) {
  const ecsql = `
    SELECT e.ECInstanceId, imodel_geom_part_ids(e.GeometryStream) AS partIds
    FROM BisCore.GeometricElement3d e
    WHERE partIds IS NOT NULL`;

  return iModel.withQueryReader(
    ecsql,
    (reader: ECSqlSyncReader) =>
      reader.toArray().map((row) => ({
        elementId: row.ecInstanceId as string,
        partIds: JSON.parse(row.partIds as string) as string[],
      })),
    undefined,
    { rowFormat: QueryRowFormat.UseJsPropertyNames },
  );
}
```

---

## Why synchronous execution is required

The geometry stream functions call into the iModel native layer to decompose flatbuffer-encoded geometry blobs. This work must happen on the same thread that holds the database connection. The async `createECsqlReader` path dispatches query work to a worker-thread pool where geometry native calls are not available — these functions will not work there.

[IModelDb.withQueryReader]($backend) runs the entire callback synchronously on the calling thread, making it the correct host for geometry stream queries.

```typescript
// ✅ Correct — withQueryReader runs synchronously on the backend
iModel.withQueryReader(ecsql, (reader) => {
  while (reader.step()) { /* ... */ }
});

// ❌ Wrong — async reader dispatches to worker threads; geometry functions will fail
for await (const row of iModel.createQueryReader(ecsql)) {
  // imodel_geom_* functions are not available here
}
```
