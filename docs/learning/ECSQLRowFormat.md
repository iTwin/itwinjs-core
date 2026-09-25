# ECSQL Row Formats

The asynchronous [ECSqlReader]($common) and synchronous [ECSqlSyncReader]($backend) use the same [QueryRowFormat]($common) options. Set `rowFormat` when calling `createQueryReader` or `withQueryReader`.

## Row proxies and materialized rows

Iteration and `step()` expose a [QueryRowProxy]($common) for the current row. It supports zero-based column indexes and case-insensitive lookup using ECSQL or JavaScript property names. The proxy follows the reader's current row; materialize a row before retaining it across reader advances.

| Operation | Result |
| --- | --- |
| `row[0]`, `row.ECInstanceId` | One value from the current row |
| `row.toArray()` | The current row's raw array of values in SELECT-column order |
| `row.toRow()` | A plain object; ECSQL property names by default, or legacy JavaScript names with the deprecated `UseJsPropertyNames` |
| `reader.toArray()` | All remaining rows, materialized according to `rowFormat`; returns a promise for the async reader |

`row.toRow()` always produces an object, including with the default index format. `reader.toArray()` uses the following formats for each collected row:

| `rowFormat` | Materialized row | Class-ID values by default |
| --- | --- | --- |
| `UseECSqlPropertyIndexes` (default) | Array in SELECT-column order | Id64 strings |
| `UseECSqlPropertyNames` | Object keyed by ECSQL column names or aliases | Id64 strings |
| `UseJsPropertyNames` (deprecated) | Object keyed by legacy JavaScript names | Class names for unaliased class-ID system properties, including navigation relationship classes |

Object rows omit null and undefined values. Array rows preserve nulls before a later non-null column, but omit trailing nulls. An omitted trailing column reads as `undefined` by index. Allow for absent values when assigning query results to TypeScript types.

See [row-format examples](./ECSQLCodeExamples.md#specifying-row-formats) for code and representative output.

## Property names

`UseECSqlPropertyNames` preserves the ECSQL column name or alias. For new code, use this format with explicit aliases and `ec_classname()` projections when JavaScript-friendly names and class names are required.

`UseJsPropertyNames` is deprecated. It lowercases the first character of ordinary property names and aliases, and maps unaliased system properties as follows. Use it only to preserve an existing result contract while migrating.

### System properties when deprecated `UseJsPropertyNames` is used

| ECSQL property | JavaScript property | Value |
| --- | --- | --- |
| `ECInstanceId` | `id` | Id64 string |
| `ECClassId` | `className` | Qualified class name |
| `SourceECInstanceId` | `sourceId` | Id64 string |
| `SourceECClassId` | `sourceClassName` | Qualified class name |
| `TargetECInstanceId` | `targetId` | Id64 string |
| `TargetECClassId` | `targetClassName` | Qualified class name |

Navigation properties use `{ id, relClassName }` in this format. The conversion includes class-ID values as well as property keys; renaming `ECClassId` to `className` alone does not convert its value.

### System properties when `UseECSqlPropertyNames` is used

System-property keys retain their ECSQL names, such as `ECInstanceId` and `ECClassId`. Navigation properties use `{ Id, RelECClassId }`, with both values represented as Id64 strings. The default index format uses the same value representation, including these nested navigation objects.

Point members retain ECSQL casing in the default index format and in `UseECSqlPropertyNames`, producing `{ X, Y }` or `{ X, Y, Z }`. The deprecated `UseJsPropertyNames` format converts them to `{ x, y }` or `{ x, y, z }`.

### Aliases and class names

Aliases determine the output key and can suppress automatic class-name conversion. For example, selecting `ECClassId AS elementClassId` preserves an ID with the default conversion options even when using JS names. The same value is exposed through index access, name access, `toRow()`, and `toArray()`. Use an explicit expression when a selected value must be a class name:

```sql
SELECT ECInstanceId, ec_classname(ECClassId, 's.c') AS className FROM bis.Element
```

The deprecated `convertClassIdsToClassNames` reader option also requests class-name conversion. Use an explicit `ec_classname()` projection instead. The deprecated `UseJsPropertyNames` format already supplies the legacy system-property conversions shown above.

## Property value types

| ECSQL value | JavaScript representation |
| --- | --- |
| Boolean | `boolean` |
| Blob | `Uint8Array` by default; a byte-count string when `abbreviateBlobs` is `true` |
| Blob with BeGuid extended type | [GuidString]($bentley) |
| Double, Integer, Int64 | `number`; account for JavaScript integer precision limits |
| DateTime | ISO 8601 date-time string |
| Instance ID or Int64 with Id extended type | [Id64String]($bentley) |
| Class-ID system property | Id64 string or qualified class name, as described above |
| Point2d | `{ X, Y }` by default; `{ x, y }` with deprecated `UseJsPropertyNames` |
| Point3d | `{ X, Y, Z }` by default; `{ x, y, z }` with deprecated `UseJsPropertyNames` |
| String | `string` |
| Navigation | `{ Id, RelECClassId }` or [NavigationValue]($common), depending on format |
| Struct | Object containing the struct's members |
| Array | Array of property values |

With `abbreviateBlobs: true`, ordinary blobs are returned as strings such as `'{"bytes":123}'`, describing their byte count instead of returning their contents. The option defaults to `false`.

Read-value support does not imply that the same value can be bound as a query parameter. See [ECSQL parameter types](./ECSQLParameterTypes.md).

## Instance JSON and `OPTIONS USE_JS_PROP_NAMES`

The SQL option `USE_JS_PROP_NAMES` applies to JSON produced by the `$` instance accessor:

```sql
SELECT $ FROM BisCore.Element OPTIONS USE_JS_PROP_NAMES
```

This option controls the properties and values inside the selected JSON instance. The reader's `rowFormat` controls the surrounding query row. Neither option selects which connection or thread executes the query. See [instance queries](./ECSqlReference/InstanceQuery.md) and [ECSQL options](./ECSqlReference/ECSqlOptions.md).

## Legacy statement rows

The deprecated [ECSqlStatement.getRow]($backend) defaults to JS-shaped rows. It also accepts [ECSqlRowArg]($backend) formatting options. When migrating, prefer `UseECSqlPropertyNames` with explicit aliases and `ec_classname()` projections. Use deprecated `UseJsPropertyNames` only when an existing caller requires the exact legacy shape. See [backend migration guidance](./backend/ECSQLCodeExamples.md#migrating-from-withpreparedstatement).
