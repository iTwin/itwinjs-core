# Backend `withQueryReader` Code Examples

This page documents the use of `withQueryReader` — a **synchronous**, backend-only method available on both [IModelDb]($backend) and [ECDb]($backend).

`withQueryReader` is the synchronous counterpart of [IModelDb.createQueryReader]($backend). Instead of returning an async [ECSqlReader]($common), it prepares the statement, invokes a callback with an [ECSqlSyncReader]($backend).

Unlike `createQueryReader`, which pages results through the async concurrent-query infrastructure, `withQueryReader` performs **true row-by-row stepping** directly against the underlying prepared statement. Each call to `step()` executes exactly one step — no rows are buffered, prefetched, or cached internally. This makes `withQueryReader` well-suited for scenarios where synchronous execution and live data fetching are important.

> **Note:** `withQueryReader` is only available on the backend. For frontend usage, use [IModelConnection.createQueryReader]($frontend).

See also:

- [General ECSQL Code Examples](../ECSQLCodeExamples.md) — `createQueryReader` usage that applies to both frontend and backend
- [Backend ECSQL Code Examples](./ECSQLCodeExamples.md) — `withPreparedStatement` usage
- [Executing ECSQL in the Backend](./ExecutingECSQL.md)
- [ECSQL Row Formats](../ECSQLRowFormat.md)

---

## The `withQueryReader` Function

Here is the TypeScript method signature for `withQueryReader`:

```ts
withQueryReader<T>(ecsql: string, callback: (reader: ECSqlSyncReader) => T, params?: QueryBinder, config?: SynchronousQueryOptions): T
```

- The `ecsql` string is the ECSQL statement to execute.
- The `callback` receives an [ECSqlSyncReader]($backend) scoped to the call. **Do not keep a reference to the reader outside the callback** — attempting to `step` it after the callback returns will throw an error.
- The `params` argument of type [QueryBinder]($common) contains any [bindings](../ECSQL.md#ecsql-parameters) for the ECSQL statement.
- The `config` argument of type `SynchronousQueryOptions` controls how results are formatted. The available options are a subset of [QueryOptions]($common):
  - `rowFormat` — how result rows are structured. See [ECSQL Row Formats](../ECSQLRowFormat.md).
  - `abbreviateBlobs` — when `true`, binary values are abbreviated rather than fully serialized.
  - `convertClassIdsToClassNames` — when `true`, ECClassId values are returned as fully-qualified class names.

---

## Iterating Over Query Results

There are three primary ways to consume results from `withQueryReader`:

### 1. Synchronous Iterator (for...of)

Use `ECSqlSyncReader` as a synchronous iterator with a `for...of` loop:

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  for (const row of reader) {
    const id = row[0];
    const classId = row[1];
    // process row...
  }
});
```

Each iterated value is a [QueryRowProxy]($common). See [Handling a Row of Query Results](#handling-a-row-of-query-results) below.

### 2. Manual Stepping with `step()`

Step through rows one at a time using [ECSqlSyncReader.step]($backend):

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  while (reader.step()) {
    const id = reader.current[0];
    const classId = reader.current[1];
    // process row...
  }
});
```

`step()` returns `true` if there are rows left to be stepped through, and `false` when all rows have been consumed.

### 3. Capture All Results with `toArray()`

Collect all remaining rows at once into an array:

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  const rows = reader.toArray();
  // rows is a plain JavaScript array
});
```

Each element of the returned array is a JavaScript literal whose shape is determined by the `rowFormat` option. See [ECSQL Row Formats](../ECSQLRowFormat.md) for details.

---

## Handling a Row of Query Results

When using the iterator or `step()`, each row is a [QueryRowProxy]($common). Values can be accessed by index or by name.

### Accessing Row Values By Index

Default behavior — column values are ordered by their position in the `SELECT` clause:

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  while (reader.step()) {
    const id: string = reader.current[0];
    const classId: string = reader.current[1];
  }
});
```

> The row format does **not** affect index-based access; only the order of columns in the SELECT statement matters.

### Accessing Row Values By Name

Use ECSQL property names as keys:

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  while (reader.step()) {
    const id: string = reader.current.ECInstanceId;
    const classId: string = reader.current.ECClassId;
  }
});
```

### Converting a Row to a JavaScript Literal

Call `.toRow()` on the [QueryRowProxy]($common) to convert it to a plain JavaScript object. The structure of the object depends on the `rowFormat` in `config`:

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  while (reader.step()) {
    const row = reader.current.toRow();
    // row is now a plain JavaScript object
    console.log(JSON.stringify(row));
  }
});
```

---

## Row Formats

The row format is controlled by `rowFormat` in the `config` parameter and mirrors the behavior of [QueryOptions]($common) used with `createQueryReader`. See [ECSQL Row Formats](../ECSQLRowFormat.md) for full details.

### `QueryRowFormat.UseECSqlPropertyIndexes` (default)

Values are accessed by the zero-based index of the column in the SELECT clause. Rows returned from `toArray()` are plain arrays:

```ts
import { QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";

const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseECSqlPropertyIndexes).getOptions();
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  const rows = reader.toArray();
  // rows[0] => ['0x17', '0x8d']
}, undefined, config);
```

### `QueryRowFormat.UseECSqlPropertyNames`

Values are keyed by their ECSQL property names. Rows from `toArray()` are objects:

```ts
import { QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";

const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseECSqlPropertyNames).getOptions();
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  const rows = reader.toArray();
  // rows[0] => { ECInstanceId: '0x17', ECClassId: '0x8d' }
}, undefined, config);
```

### `QueryRowFormat.UseJsPropertyNames`

Values are keyed by JavaScript-style property names (e.g., `ECInstanceId` → `id`, `ECClassId` → `className`):

```ts
import { QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";

const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseJsPropertyNames).getOptions();
iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM BisCore.Element", (reader) => {
  const rows = reader.toArray();
  // rows[0] => { id: '0x17', className: 'BisCore.SpatialCategory' }
}, undefined, config);
```

---

## Parameter Bindings

Parameters are supplied as a [QueryBinder]($common) instance. See [ECSQL Parameter Types](../ECSQLParameterTypes.md) for type information.

### Positional Parameters

```ts
import { QueryBinder } from "@itwin/core-common";

const params = new QueryBinder();
params.bindString(1, "BisCore.Category");

iModel.withQueryReader(
  "SELECT ECInstanceId FROM BisCore.Element WHERE ECClassId=?",
  (reader) => {
    while (reader.step()) {
      console.log(reader.current[0]);
    }
  },
  params,
);
```

### Named Parameters

```ts
import { QueryBinder } from "@itwin/core-common";

const params = new QueryBinder();
params.bindString("className", "BisCore.Category");

iModel.withQueryReader(
  "SELECT ECInstanceId FROM BisCore.Element WHERE ECClassId=:className",
  (reader) => {
    while (reader.step()) {
      console.log(reader.current[0]);
    }
  },
  params,
);
```

### Navigation Properties

[Navigation properties](../ECSQL.md#navigation-properties) require a [NavigationBindingValue]($common):

```ts
import { NavigationBindingValue, QueryBinder } from "@itwin/core-common";

const params = new QueryBinder();
params.bindNavigation(1, { id: "0x1" } as NavigationBindingValue);

iModel.withQueryReader(
  "SELECT ECInstanceId FROM BisCore.Element WHERE Parent=?",
  (reader) => {
    while (reader.step()) {
      console.log(reader.current[0]);
    }
  },
  params,
);
```

### Id Set Parameters

Bind a set of [Id64String]($bentley) values for use with `InVirtualSet`:

```ts
import { QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";

const params = new QueryBinder();
params.bindIdSet(1, ["0x1", "0x2", "0x3"]);

const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseJsPropertyNames).getOptions();
iModel.withQueryReader(
  "SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)",
  (reader) => {
    const rows = reader.toArray();
    // rows => [{ id: '0x1', name: '...' }, ...]
  },
  params,
  config,
);
```

---

## Getting Column Metadata

Use [ECSqlSyncReader.getMetaData]($backend) to retrieve metadata about the result columns. This is available before or after calling `step()`:

```ts
iModel.withQueryReader("SELECT ECInstanceId, ECClassId, LastMod FROM BisCore.Element", (reader) => {
  const metadata = reader.getMetaData();
  for (const col of metadata) {
    console.log(col.accessString, col.typeName);
  }
  while (reader.step()) {
    // process rows...
  }
});
```

---

## Returning a Value from the Callback

`withQueryReader` returns whatever value the callback returns, making it easy to compute and return an aggregated result:

```ts
const count = iModel.withQueryReader("SELECT ECInstanceId FROM BisCore.Element", (reader) => {
  let n = 0;
  while (reader.step()) {
    n++;
  }
  return n;
});
console.log(`Element count: ${count}`);
```

---

## Important Constraints

- **Do not use the reader outside the callback.** The underlying statement is disposed when the callback returns. Calling `step()` on a reader that has escaped its callback will throw an error:

  ```ts
  // ❌ This will throw when step() is called
  const escaped = iModel.withQueryReader("SELECT * FROM BisCore.Element", (reader) => reader);
  escaped.step(); // throws: "Statement is not prepared"
  ```

- **Do not call `clearCaches()` or close the database during iteration.** Either action invalidates the prepared statement and causes a subsequent `step()` call to throw.

- **`SynchronousQueryOptions` is a restricted subset of `QueryOptions`.** Options that only apply to the async concurrent-query infrastructure — such as `limit`, `priority`, `restartToken`, `delay`, `usePrimaryConn`, and `quota` — are not available in `withQueryReader`.
