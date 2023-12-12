---
publish: false
---
# NextVersion

Table of contents:

- [ECSql enhancements](#ecsq-enhancements)
  - [Instance properties](#instance-properties)
  - [Window functions](#window-functions)

## ECSql enhancements

### Instance properties

ECSQL supports querying instance properties, which are any property in a class selected in ECSql or its derived classes.

[**ECSQL Instance Properties Documentation**](../learning/ECSQLTutorial/ECSqlSyntax.md#instance-query)

### Window functions

ECSQL now supports [window functions](../learning/ECSQLTutorial/ECSqlSyntax.md#window-functions). **This functionality add following new keywords that might collide with alias, parameter, property or class name and may break existing queries.** Application need to [escape](../learning/ECSQLTutorial/ECSqlSyntax.md#escaping-keywords) those name or try escaping all names in their queries to be on safe side in future.

- `CURRENT`
- `EXCLUDE`
- `FILTER`
- `FOLLOWING`
- `GROUPS`
- `LAG`
- `LEAD`
- `NO`
- `NTILE`
- `PARTITION`
- `PRECEDING`
- `RANGE`
- `ROW`
- `ROWS`
- `TIES`
- `UNBOUNDED`
