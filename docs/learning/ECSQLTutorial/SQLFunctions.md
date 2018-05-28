---
ignore: true
---
# SQL Functions

Any SQL function can be used in ECSQL. This includes functions built into SQLite (see [SQLite Functions overview](https://www.sqlite.org/lang_corefunc.html)) or functions built into iModelJs, like the [geometry functions](../GeometrySqlFuncs.md) which you can use for [spatial queries](../SpatialQueries.md).

> **Try it yourself**
>
> *Goal:* Return all Elements whose UserLabel contains the string 'Recreation'
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM bis.Element WHERE instr(UserLabel,'Recreation')`
>
> *Result*
>
> ECInstanceId | CodeValue
> -- | --
> lll | XX
> xxx | YY
> xxx | ZZ
