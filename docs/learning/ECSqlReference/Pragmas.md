# Pragmas

## `PRAGMA help`

Print out list of pragma supported by ECSQL.

```sql
PRAGMA help
```

| pragma                        | type   | descr                                                                       |
| ----------------------------- | ------ | --------------------------------------------------------------------------- |
| checksum                      | global | checksum([ec_schema OR ec_map OR db_schema]) return sha1 checksum for data. |
| ecdb_ver                      | global | return current and file profile versions                                    |
| experimental_features_enabled | global | enable/disable experimental features                                        |
| explain_query                 | global | explain query plan                                                          |
| help                          | global | return list of pragma supported                                             |
| integrity_check               | global | performs integrity checks on ECDb                                           |
| parse_tree                    | global | parse_tree(ecsql) return parse tree of ecsql.                               |
| disqualify_type_index         | class  | set/get disqualify_type_index flag for a given ECClass                      |

## `PRAGMA ecdb_ver`

Print out ECDb current profile version supported by software and file profile version.

```sql
PRAGMA ecdb_ver
```

| current | file    |
| ------- | ------- |
| 4.0.0.4 | 4.0.0.2 |

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

// experimental_features_enabled
// -----------------------------
// False
```

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

output of above will look like listing all check with result and time took to run the test.

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

[ECSql Syntax](./index.md)
