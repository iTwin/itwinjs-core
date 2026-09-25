# ECSQLOPTIONS or OPTIONS clause

`ECSQLOPTIONS` (or `OPTIONS` for short) specify flags that affect processing of an ECSQL statement.

Syntax: `<select-stmt> OPTIONS option[=val] [option[=val] ...]`

Supported options include:

1. `USE_JS_PROP_NAMES` returns JSON from the instance accessor that is compatible with iTwin.js TypeScript types.
1. `DO_NOT_TRUNCATE_BLOB` returns the full blob instead of truncating it when using the instance accessor.
1. `ENABLE_EXPERIMENTAL_FEATURES` enables experimental features.
1. `NAV_REL_CLASSID_FALLBACK` treats an end-table navigation property with a non-null `Id` and null `RelECClassId` as an instance of the relationship declared by the navigation property. It affects relationship class queries and [`ECVLib.Relations()`](./Relations.md), but does not change the stored navigation property's `RelECClassId`.

`NAV_REL_CLASSID_FALLBACK` is intended for legacy data that omitted the relationship class id. It adds an `OR ... IS NULL` predicate and an `IFNULL` projection, which may result in less efficient query plans. Enable it only for queries that need the compatibility behavior.

Get instance as json which is compatible with itwin.js.

```sql
SELECT $ FROM [BisCore].[Element] OPTIONS USE_JS_PROP_NAMES
/*
$
--------------------
{
   "id":"0x1",
   "className":"BisCore.Subject",
   "model":{
      "id":"0x1",
      "relClassName":"BisCore.ModelContainsElements"
   },
   "lastMod":"2023-12-06T15:24:45.785Z",
   "codeSpec":{
      "id":"0x1f",
      "relClassName":"BisCore.CodeSpecSpecifiesCode"
   },
   "codeScope":{
      "id":"0x1",
      "relClassName":"BisCore.ElementScopesCode"
   },
   "codeValue":"Subject of this imodel",
   "description":""
}
*/
```

[ECSql Syntax](./index.md)
