# Pragmas

## `PRAGMA help`

Print out list of pragma supported by ECSQL.

```sql
PRAGMA help
```

| pragma                        | type   | descr                                                                           |
| ----------------------------- | ------ | ------------------------------------------------------------------------------- |
| checksum                      | global | checksum([ecdb_schema\|ecdb_map\|sqlite_schema]) return sha3 checksum for data. |
| ecdb_ver                      | global | return current and file profile versions                                        |
| experimental_features_enabled | global | enable/disable experimental features                                            |
| validate_ecsql_writes         | global | enable/disable validation for values in an ecsql statement                      |
| explain_query                 | global | explain query plan                                                              |
| help                          | global | return list of pragma supported                                                 |
| integrity_check               | global | performs integrity checks on ECDb                                               |
| parse_tree                    | global | parse_tree(ecsql) return parse tree of ecsql.                                   |
| schema_view                   | global | returns a curated subset of schema metadata as a binary blob                    |
| schema_view_fragment          | global | returns a chosen subset of schemas as a binary blob, for incremental loading    |
| schema_token                  | global | returns a cheap hash of all schema names and versions, for cache invalidation   |
| disqualify_type_index         | class  | set/get disqualify_type_index flag for a given ECClass                          |

## `PRAGMA checksum`

Calculate and print out SHA3 256 hash for a subset of the `ec_` tables or the sqlite schema

```sql
PRAGMA checksum('ecdb_map')
```

- **ecdb_schema** - Includes only the ec definition tables but not the mapping tables
  > `ec_Schema`, `ec_SchemaReference`, `ec_Class`, `ec_ClassHasBaseClasses`, `ec_Enumeration`, `ec_KindOfQuantity`, `ec_UnitSystem`, `ec_Phenomenon`, `ec_Unit`, `ec_Format`, `ec_FormatCompositeUnit`, `ec_PropertyCategory`, `ec_Property`, `ec_RelationshipConstraint`, `ec_RelationshipConstraintClass`, `ec_CustomAttribute`
- **ecdb_map** - Includes only the ec mapping tables but not the ec definition tables
  > `ec_PropertyPath`, `ec_ClassMap`, `ec_Table`, `ec_Column`, `ec_Index`, `ec_IndexColumn`, `ec_PropertyMap`
- **sqlite_schema** - Includes information in the `sqlite_master` table

## `PRAGMA ecdb_ver`

Print out ECDb current profile version supported by software and file profile version.

```sql
PRAGMA ecdb_ver
```

| current | file    |
| ------- | ------- |
| 4.0.0.4 | 4.0.0.2 |

## `PRAGMA ecsql_ver`

Print out the current ECSQL version supported by the software. This will allow applications to check feature availability when working with ECSql.

```sql
PRAGMA ecsql_ver
```

| ecsql_ver |
| --------- |
| 2.0.3.1   |

## `PRAGMA sqlite_sql`

Print out the underlying sqlite/native sql as a string. This will help debugging ECSql statements.

```sql
PRAGMA sqlite_sql([SELECT * FROM meta.ECClassDef WHERE Name='Element'])
```

| sqlite_sql                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT [ECClassDef].[ECInstanceId],[ECClassDef].[ECClassId],[ECClassDef].[SchemaId],[ECClassDef].[SchemaRelECClassId],[ECClassDef].[Name],[ECClassDef].[DisplayLabel],[ECClassDef].[Description],[ECClassDef].[Type],[ECClassDef].[Modifier],[ECClassDef].[CustomAttributeContainerType],[ECClassDef].[RelationshipStrength],[ECClassDef].[RelationshipStrengthDirection] FROM (SELECT [Id] ECInstanceId,15 ECClassId,[SchemaId],(CASE WHEN [SchemaId] IS NULL THEN NULL ELSE 16 END) [SchemaRelECClassId],[Name],[DisplayLabel],[Description],[Type],[Modifier],[CustomAttributeContainerType],[RelationshipStrength],[RelationshipStrengthDirection] FROM [main].[ec_Class]) [ECClassDef] WHERE [ECClassDef].[Name]='Element' |

## `PRAGMA experimental_features_enabled`

Enable experimental feature in ECSQL on current connection.

```sql
PRAGMA experimental_features_enabled=true
```

to switch off

```sql
PRAGMA experimental_features_enabled=false
```

to check if flag is currently set.

```sql
PRAGMA experimental_features_enabled
```

| experimental_features_enabled |
| ----------------------------- |
| False                         |

## `PRAGMA validate_ecsql_writes`

Enable validation of values in ECSQL insert statement on current connection.

```sql
PRAGMA validate_ecsql_writes=true
```

to switch off

```sql
PRAGMA validate_ecsql_writes=false
```

to check if flag is currently set.

```sql
PRAGMA validate_ecsql_writes
```

| validate_ecsql_writes |
| --------------------- |
| False                 |

## `PRAGMA explain_query`

Prints out a high level description of the strategy or plan SQLite uses to implement a specific SQL query generated by the input ECSql query.  For use in interactive debugging purposes, the output of this command may change in the future.

```sql
PRAGMA explain_query ('SELECT * FROM bis.GeometricElement3d')
```

| id  | parent | notused | detail                                                      |
| --- | ------ | ------- | ----------------------------------------------------------- |
| 3   | 0      | 215     | SCAN main.bis_GeometricElement3d                            |
| 5   | 0      | 45      | SEARCH main.bis_Element USING INTEGER PRIMARY KEY (rowid=?) |

## `PRAGMA integrity_check` (experimental)

1. `check_ec_profile` - checks if the profile table, indexes, and triggers are present. Does not check be\_\* tables. Issues are returned as a list of tables/indexes/triggers which were not found or have different DDL.
2. `check_data_schema` - checks if all the required data tables and indexes exist for mapped classes. Issues are returned as a list of tables/columns which were not found or have different DDL.
3. `check_data_columns` - checks if all the required columns exist in data tables. Issues are returned as a list of those tables/columns.
4. `check_nav_class_ids` - checks if `RelClassId` of a Navigation property is a valid ECClassId. It does not check the value to match the relationship class.
5. `check_nav_ids` - checks if `Id` of a Navigation property matches a valid row primary class.
6. `check_linktable_fk_class_ids` - checks if `SourceECClassId` or `TargetECClassId` of a link table matches a valid ECClassId.
7. `check_linktable_fk_ids`- checks if `SourceECInstanceId` or `TargetECInstanceId` of a link table matches a valid row in primary class.
8. `check_class_ids`- checks persisted `ECClassId` in all data tables and makes sure they are valid.
9. `check_schema_load` - checks if all schemas can be loaded into memory.

```sql
PRAGMA integrity_check ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES;
```

The output of `integrety_check` is a table with each test performed, the result and time took to run the test.

| sno | check                        | result | elapsed_sec |
| --- | ---------------------------- | ------ | ----------- |
| 1   | check_data_columns           | True   | 0.005       |
| 2   | check_ec_profile             | True   | 0.001       |
| 3   | check_nav_class_ids          | True   | 0.179       |
| 4   | check_nav_ids                | True   | 0.403       |
| 5   | check_linktable_fk_class_ids | True   | 0.001       |
| 6   | check_linktable_fk_ids       | False  | 0.003       |
| 7   | check_class_ids              | True   | 0.039       |
| 8   | check_data_schema            | True   | 0.000       |
| 9   | check_schema_load            | True   | 0.000       |

## `PRAGMA parse_tree` (experimental)

Generates a json representation parsed tree of the input ECSql.

```sql
PRAGMA parse_tree ('SELECT ECClassId, CodeValue FROM bis.GeometricElement3d') ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

```json
{
  "id": "SelectStatementExp",
  "select": {
    "id": "SingleSelectStatementExp",
    "selection": [
      {
        "id": "DerivedPropertyExp",
        "exp": {
          "id": "PropertyNameExp",
          "path": "ECClassId"
        }
      },
      {
        "id": "DerivedPropertyExp",
        "exp": {
          "id": "PropertyNameExp",
          "path": "CodeValue"
        }
      }
    ],
    "from": [
      {
        "id": "ClassNameExp",
        "tableSpace": "",
        "schemaName": "BisCore",
        "className": "GeometricElement3d"
      }
    ]
  }
}
```

## `PRAGMA schema_view`

Returns a curated subset of EC schema metadata from the connection as a single compact binary blob. This is used internally by `SchemaView` to hydrate a lightweight, read-only schema cache in a single round-trip instead of loading each schema individually. The subset is described in [SchemaView - What is included / excluded](../metadata/SchemaView.md#what-is-included).

The pragma accepts an optional integer argument to select the binary format version. When omitted, the latest supported version is returned (currently v1).

```sql
PRAGMA schema_view
```

Explicitly request format version 1:

```sql
PRAGMA schema_view(1)
```

The result is a single row with the following columns:

| Column        | Type    | Description                                                                   |
| ------------- | ------- | ----------------------------------------------------------------------------- |
| format        | string  | Format identifier (currently `binary`)                                        |
| formatVersion | integer | The format version of the returned blob                                       |
| data          | binary  | The schema metadata blob                                                      |
| schemaToken   | string  | Cheap schema-identity hash (see [`schema_token`](#pragma-schema_token)), usable as a cache-invalidation key |

The pragma is read-only. Attempting to set a value returns an error.

Passing an unsupported format version returns an error:

```sql
-- ERROR: unsupported format version
PRAGMA schema_view(99)
```

The pragma works against any ECDb profile from `4.0.0.1` onward; older files do not need to be upgraded first. On profile `4.0.0.1` only, `KindOfQuantity` persistence and presentation strings are returned in legacy FUS format rather than EC3.2; all other data is unaffected. See [SchemaViewBinaryFormat - ECDb Profile Compatibility](../metadata/SchemaViewBinaryFormat.md#ecdb-profile-compatibility) for details.

## `PRAGMA schema_view_fragment`

Returns the same binary format as [`schema_view`](#pragma-schema_view), but for a chosen **subset** of the connection's schemas instead of all of them. This backs incremental loading of a `SchemaView`: a consumer can hydrate only the schemas it needs - for example `BisCore` and its references - rather than every schema in the iModel. A fragment is a content subset of the *identical* format, not a different format, so the blob it returns is parsed exactly like a `schema_view` blob. See [SchemaViewBinaryFormat - Fragments](../metadata/SchemaViewBinaryFormat.md#fragments-partial-blobs).

The single string argument is a comma-separated list of `ec_Schema` ECInstanceIds in decimal, optionally prefixed with a `v<N>;` format-version token:

```sql
-- Latest format version; schemas with ec_Schema.Id 131, 145, 150
PRAGMA schema_view_fragment('131,145,150')
```

```sql
-- Explicitly request binary format version 1
PRAGMA schema_view_fragment('v1;131,145,150')
```

The caller must pass a **dependency-closed** id set - every schema referenced by a requested schema is also in the list - computed from the schema reference graph (`meta.ECSchemaDef` + `meta.SchemaHasSchemaReferences`). The pragma does not expand references itself.

The result row has the same columns as [`schema_view`](#pragma-schema_view): `format`, `formatVersion`, `data`, `schemaToken`.

The pragma is read-only. It fails (returning no blob, not a partial one) on an empty list, a non-integer or non-existent schema id, a duplicate id, or a malformed or unsupported `v<N>;` prefix.

### Why the format version is embedded in the argument string

The fragment pragma needs two independent inputs - the blob format version and the set of schema ids - but the ECSQL pragma infrastructure today only supports exactly **one** scalar argument (`pragma_value` is a single token). Putting the version inside that one string, as an optional self-tagged `v<N>;` prefix, is deliberate. The alternatives are worse or require refactoring the pragma infrastructure.

The embedded `v<N>;` prefix is self-describing (`v1` reads as "version 1"), cannot collide with the id list (`v`, `;`, and `,` never appear in a decimal id), and is read **first** so a future format that changes the id-list encoding can dispatch on the version before parsing the rest - the role a leading version byte plays in any binary wire format. It also keeps this pragma consistent with `schema_view`, where the format version is likewise the single optional leading argument; the common case `schema_view_fragment('131,145,150')` stays clean and means "latest version." The choice is reversible: if pragmas ever gain real multi-argument support, the prefix can be promoted to a proper second argument while the string form is accepted during a deprecation window.

## `PRAGMA schema_token`

Returns a cheap hash that identifies the current set of schemas - their **names and versions only**. It is intended as a cache-invalidation key for a [`SchemaView`](../metadata/SchemaView.md): hold onto the `schemaToken` column returned by [`schema_view`](#pragma-schema_view) / [`schema_view_fragment`](#pragma-schema_view_fragment), and later compare it against `PRAGMA schema_token` to decide whether the cached view is stale. The value is **identical** to that `schemaToken` column, by construction.

```sql
PRAGMA schema_token
```

The result is a single row with one column:

| Column | Type   | Description                                              |
| ------ | ------ | -------------------------------------------------------- |
| token  | string | SHA3-256 hash of every schema's name and version digits |

The pragma is read-only. Attempting to set a value returns an error.

### Why a dedicated token instead of `checksum(ecdb_schema)`

`PRAGMA checksum(ecdb_schema)` hashes the full contents of every `ec_` metadata table - every class, property, relationship constraint, and custom-attribute instance in the file. On a large iModel that is a multi-second, full-schema scan (it is dominated by the `ec_CustomAttribute` XML blobs), which defeats the point of incremental schema loading: each fragment fetch would re-hash the entire schema. `schema_token` instead hashes only the `ec_Schema` rows (name + version), which is one tiny row per schema, so it is effectively free regardless of iModel size.

### Limitation: same-version content changes are not detected

Because `schema_token` hashes schema **identity** (name + version), not schema **contents**, it does not change when a schema is modified without bumping its version. ECDb normally forbids re-importing changed schema content without a version increment, so in practice this only affects **dynamic schemas**, which ECDb permits to be re-imported in place. There is no cheap way to detect a content change without reading the contents, which is exactly the cost this pragma exists to avoid.

For the SchemaView use case this is acceptable: dynamic schemas are predominantly imported via changesets generated by connectors, and frontend code already invalidates the cached view after pulling changes. Consumers that must be robust against in-place dynamic-schema edits should invalidate their cached view explicitly after such an import rather than relying on the token. If this ever proves to be a real problem, a cheap per-schema content checksum column on `ec_Schema` could be introduced later without changing this pragma's contract.

[ECSql Syntax](./index.md)
