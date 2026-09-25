# ECSQLOPTIONS or OPTIONS clause

`ECSQLOPTIONS` (or `OPTIONS` for short) specifies flags that affect processing of the ECSQL statement.

Syntax: `<select-stmt> OPTIONS option[=val] [,...]`

Supported options include:

1. `USE_JS_PROP_NAMES` formats JSON from the instance accessor using JavaScript property names and class-name values.
1. `DO_NOT_TRUNCATE_BLOB` returns the full blob instead of truncating it when using the instance accessor.
1. `ENABLE_EXPERIMENTAL_FEATURES` enables experimental features.

`USE_JS_PROP_NAMES` controls the JSON produced by the `$` instance accessor. The reader option `QueryRowFormat.UseJsPropertyNames` controls the surrounding query-row representation. See [ECSQL row formats](../ECSQLRowFormat.md#instance-json-and-options-use_js_prop_names).

Get an instance as JSON with iTwin.js property names:

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
