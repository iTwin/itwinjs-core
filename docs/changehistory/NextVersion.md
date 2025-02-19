---
publish: false
---

# NextVersion

Table of contents:

- [Deprecated ECSqlStatement](#deprecated-ecsqlstatement)

## Deprecated ECSqlStatement

`ECSqlStatement` is deprecated in 4.11 Use [IModelDb.createQueryReader]($backend) or [ECDb.createQueryReader]($backend)

Following are related classes to ECSqlStatement that are also marked depercated
  * `ECEnumValue`
  * `ECSqlValue`
  * `ECSqlValueIterator`
  * `ECSqlColumnInfo`

  In concurrent query `QueryOptions.convertClassIdsToClassNames` & `QueryOptionsBuilder.setConvertClassIdsToNames()` are deprecated. Use ECSQL ec_classname() function to convert class ids to class names.
  