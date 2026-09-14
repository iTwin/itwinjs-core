# Pragmas

## `PRAGMA help`

Print out list of pragma supported by ECSQL.

```sql
PRAGMA help
```

| pragma                        | type   | descr                                                                           |
| ----------------------------- | ------ | ------------------------------------------------------------------------------- |
| checksum                      | global | checksum([ecdb_schema\|ecdb_map\|sqlite_schema\|schema_token]) return sha3 checksum for data. |
| ecdb_ver                      | global | return current and file profile versions                                        |
| experimental_features_enabled | global | enable/disable experimental features                                            |
| validate_ecsql_writes         | global | enable/disable validation for values in an ecsql statement                      |
| explain_query                 | global | explain query plan                                                              |
| help                          | global | return list of pragma supported                                                 |
| integrity_check               | global | performs integrity checks on ECDb                                               |
| parse_tree                    | global | parse_tree(ecsql) return parse tree of ecsql.                                   |
| schema_view                   | global | returns a curated subset of schema metadata as a binary blob                    |
| schema_view_fragment          | global | returns a chosen subset of schemas as a binary blob, for incremental loading    |
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
- **schema_token** - A cheap schema-**identity** hash (every schema's name and version only, one tiny row per schema), intended as a cache-invalidation key for [`SchemaView`](../metadata/SchemaView.md).

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

Checks ECDb schema and data consistency without modifying the database. It is available on read-only connections. [IModelDb.integrityCheck]($core-backend) wraps the pragma for backend TypeScript callers.

| Check | Reports |
| --- | --- |
| `check_ec_profile` | Expected EC profile tables/indexes or iModel triggers that are missing or have different SQL definitions. Does not check `be_*` tables. |
| `check_data_schema` | Missing physical tables or indexes recorded in ECDb's mapping metadata. Checks names and object types, not SQL definitions. |
| `check_data_columns` | Nonvirtual mapped columns missing from their physical tables. Checks column names, not types or constraints. |
| `check_nav_class_ids` | Non-null stored `RelECClassId` values outside the navigation property's declared relationship class and its derived classes. This is a relationship class ID, not the referenced instance's class ID. |
| `check_nav_ids` | Non-null navigation `.Id` values that do not resolve to an instance in the referenced-class query. See [Navigation ID results](#navigation-id-results). |
| `check_linktable_fk_class_ids` | `SourceECClassId` or `TargetECClassId` values that do not match an ECClass definition. Does not compare the class ID with the endpoint instance's actual class. |
| `check_linktable_fk_ids` | Source or target instance IDs that are null or do not resolve to a row in the endpoint-class query. The query uses the first relationship constraint class for that endpoint and includes derived classes. |
| `check_class_ids` | Persisted `ECClassId` values with no matching ECClass definition, checked through primary, joined and overflow tables. Checks class existence, not whether the class belongs in that table. |
| `check_schema_load` | Schemas recorded in the database that the schema manager cannot load. The result identifies the schema but does not explain why loading failed. |
| `check_missing_child_rows` | Elements with a `bis_Element` row but missing a required row in another mapped table. See [Missing child-row results](#missing-child-row-results). |
| `check_diverged_prop_maps` | An inherited property mapped to different columns by a derived class and a base class within the same physical table hierarchy. See [Diverged property-map results](#diverged-property-map-results). |

### Summary results

Without a check name, the pragma runs all checks listed above **except `check_missing_child_rows`**. It stops each check at its first problem and returns one summary row per check. This is the quick mode used by `IModelDb.integrityCheck()` by default.

```sql
PRAGMA integrity_check ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES;
```

| Column | Meaning |
| --- | --- |
| `sno` | One-based result row number. |
| `check` | Check name from the table above. |
| `result` | `true` if the check found no problems; `false` if it found a problem. |
| `elapsed_sec` | Elapsed time for that check, in seconds, formatted as a string. |

### Detailed results

Pass a check name to return its problem rows. An empty result means the selected check found no problems. Query execution errors can prevent a check from completing and are distinct from returned problem rows.

```sql
PRAGMA integrity_check(check_nav_ids) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES;
```

Each detailed result includes a one-based `sno`. Other fields depend on the selected check. `IModelDb.integrityCheck` accepts selections through `IntegrityCheckOptions.specificChecks`; enable all eleven options and set `quickCheck: false` to get full detailed coverage without also running the summary checks.

### Navigation ID results

A [navigation property](../ECSQL.md#navigation-properties) stores the **referenced instance's ECInstanceId** in its `.Id` member. For example, `Element.Model.Id` identifies the model containing that element.

`check_nav_ids` resolves the navigation property's relationship constraint class, then looks for a referenced row with that ID. The query includes derived classes and uses the first constraint class for the navigation direction. Null navigation IDs are ignored.

| Pragma column | API field | Meaning |
| --- | --- | --- |
| `id` | `id` | ECInstanceId of the instance containing the navigation property. |
| `class` | `class` | Class declaring the navigation property and used to query source rows. A reported instance may belong to a derived class. |
| `property` | `property` | Navigation property name. |
| `nav_id` | `navId` | The property's non-null `.Id`: the referenced instance's ECInstanceId. |
| `primary_class` | `primaryClass` | The class queried for the referenced instance, including derived classes. |

A result means the referenced-class query found **no row with that ID**. The class definition was resolved before the query ran. The result does not distinguish an absent instance from an instance outside that class hierarchy, and contains no further per-row error message.

For `Element.Model`, the check is equivalent to:

```sql
SELECT e.ECInstanceId AS id, e.Model.Id AS nav_id
FROM BisCore.Element e
LEFT JOIN BisCore.Model m ON m.ECInstanceId = e.Model.Id
WHERE e.Model.Id IS NOT NULL AND m.ECInstanceId IS NULL;
```

### Missing child-row results

```sql
PRAGMA integrity_check(check_missing_child_rows) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES;
```

An element can occupy rows in several physical tables. This check starts with existing `bis_Element` rows and looks for required child-table rows with the same element ID. It checks physical storage rows, not parent/child element relationships.

Results contain `class` (`BisCore:Element`), `id` (element ID), `class_id` (the element's ECClassId), and `MissingRowInTables`. The last field is a comma-separated list of **all child tables checked** for that class; at least one lacks a row, but the list does not identify which ones are missing. The TypeScript API names these last two fields `classId` and `missingRowInTables`.

### Diverged property-map results

```sql
PRAGMA integrity_check(check_diverged_prop_maps) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES;
```

This check compares the storage mappings of an inherited property in a derived class and each base class. It reports different columns within a shared physical table hierarchy. It excludes `ECDbSystem` properties and mappings under different physical table roots, and does not compare instance values.

Results identify the derived class (`derivedClassId`, `derivedClassName`), base class (`baseClassId`, `baseClassName`), property access path (`propertyName`), and the two `table.column` mappings (`baseColumn`, `divergedColumn`).

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
| schemaToken   | string  | Cheap schema-identity hash (see [`checksum(schema_token)`](#using-schema_token-for-cache-invalidation)), usable as a cache-invalidation key |

The pragma is read-only. Attempting to set a value returns an error.

Passing an unsupported format version returns an error:

```sql
-- ERROR: unsupported format version
PRAGMA schema_view(99)
```

The pragma works against any ECDb profile from `4.0.0.1` onward; older files do not need to be upgraded first. On profile `4.0.0.1` only, `KindOfQuantity` persistence and presentation strings are returned in legacy FUS format rather than EC3.2; all other data is unaffected. See [SchemaViewBinaryFormat - ECDb Profile Compatibility](../metadata/SchemaViewBinaryFormat.md#ecdb-profile-compatibility) for details.

## `PRAGMA schema_view_fragment`

Returns the same binary format as [`schema_view`](#pragma-schema_view), but for a chosen **subset** of the connection's schemas instead of all of them. This backs incremental loading of a `SchemaView`: a consumer can hydrate only the schemas it needs - for example `BisCore` and its references - rather than every schema in the iModel. A fragment is a content subset of the *identical* format, not a different format, so the blob it returns is parsed exactly like a `schema_view` blob. See [SchemaViewBinaryFormat - Fragments](../metadata/SchemaViewBinaryFormat.md#fragments-partial-blobs).

The single string argument is a comma-separated list of schema names, optionally prefixed with a `v<N>;` format-version token. Names are matched case-insensitively:

```sql
-- Latest format version
PRAGMA schema_view_fragment('BisCore,Generic')
```

```sql
-- Explicitly request binary format version 1
PRAGMA schema_view_fragment('v1;BisCore,Generic')
```

The pragma does not expand references itself - the caller controls exactly which schemas the blob contains, computed from the schema reference graph (`meta.ECSchemaDef` + `meta.SchemaHasSchemaReferences`). What set to pass depends on how the blob is consumed:

- **Parsed standalone** (used on its own to build a `SchemaView`): pass a **dependency-closed** set - every schema referenced by a requested schema is also in the list. A referenced schema left out leaves its cross-references unresolved; they parse as "not present", the same as an [excluded schema](../metadata/SchemaView.md).
- **Merged into an existing view** (incremental loading): references already merged from an earlier fragment may be omitted. Cross-references resolve against the accumulated view, so only the still-missing schemas need to be in the list. The incremental loader relies on this to avoid re-fetching schemas it already has.

The result row has the same columns as [`schema_view`](#pragma-schema_view): `format`, `formatVersion`, `data`, `schemaToken`.

The pragma is read-only. It fails (returning no blob, not a partial one) on an empty list, a malformed or non-existent schema name, or a malformed or unsupported `v<N>;` prefix. Duplicate names are de-duplicated, not rejected.

### Why the format version is embedded in the argument string

The fragment pragma needs two independent inputs - the blob format version and the set of schema names - but the ECSQL pragma infrastructure today only supports exactly **one** scalar argument (`pragma_value` is a single token). Putting the version inside that one string, as an optional self-tagged `v<N>;` prefix, is deliberate. The alternatives are worse or require refactoring the pragma infrastructure.

The embedded `v<N>;` prefix is self-describing (`v1` reads as "version 1"), cannot collide with the name list (schema names are ECNames, which never contain `;` or `,`), and is read **first** so a future format that changes the list encoding can dispatch on the version before parsing the rest - the role a leading version byte plays in any binary wire format. It also keeps this pragma consistent with `schema_view`, where the format version is likewise the single optional leading argument; the common case `schema_view_fragment('BisCore,Generic')` stays clean and means "latest version." The choice is reversible: if pragmas ever gain real multi-argument support, the prefix can be promoted to a proper second argument while the string form is accepted during a deprecation window.

## Using `schema_token` for cache invalidation

`PRAGMA checksum(schema_token)` returns a cheap hash that identifies the current set of schemas - their **names and versions only**. It is intended as a cache-invalidation key for a [`SchemaView`](../metadata/SchemaView.md): hold onto the `schemaToken` column returned by [`schema_view`](#pragma-schema_view) / [`schema_view_fragment`](#pragma-schema_view_fragment), and later compare it against `PRAGMA checksum(schema_token)` to decide whether the cached view is stale.

```sql
PRAGMA checksum(schema_token)
```

Like the other `checksum` keys, the result is a single row whose `sha3_256` column holds the SHA3-256 hash - here, of every schema's name and version digits.

[ECSql Syntax](./index.md)
