# ECSQLOPTIONS or OPTIONS clause

`ECSQLOPTIONS` which can also be written as just `OPTIONS` use to specify flags thats will effect processing of ECSQL statement.

Syntax: `<select-stmt> OPTIONS option[=val] [,...]`

Here is list of supported options

1. `USE_JS_PROP_NAMES` returns json from instance accessor, compilable with iTwin.js typescript.
1. `DO_NOT_TRUNCATE_BLOB` return full blob instead of truncating it when using instance accessor.
1. `ENABLE_EXPERIMENTAL_FEATURES` enable experimental features.

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
