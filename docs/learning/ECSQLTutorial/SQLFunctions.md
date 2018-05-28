---
ignore: true
---
# SQL Functions

SQL functions, either built into SQLite or custom SQL functions, can be used in ECSQL.

See also [SQLite Functions overview](https://www.sqlite.org/lang_corefunc.html).

> **Try it yourself**
>
> *Goal:* Return all Elements whose UserLabel contains the string 'Recreation'
>
> *ECSQL:* `SELECT ECInstanceId FROM bis.Element WHERE instr(UserLabel,'Recreation')`
>
> *Result*
>
> ECInstanceId | ECClassId
> -- | --
> lll | XX
> xxx | YY
> xxx | ZZ
