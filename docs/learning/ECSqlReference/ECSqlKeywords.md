# ECSQL Keywords

| Key | Keywords                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `ALL`, `AND`, `ANY`, `AS`, `ASC`, `AVG`                                                                                                 |
| B   | `BACKWARD`, `BETWEEN`, `BINARY`, `BLOB`, `BOOLEAN`, `BY`                                                                                |
| C   | `CASE`, `CAST`, `COLLATE`, `COUNT`, `CROSS`. `CUME_DIST`, `CURRENT`, `CURRENT_DATE`, `CURRENT_TIME`, `CURRENT_TIMESTAMP`                |
| D   | `DATE`, `DELETE`, `DENSE_RANK`, `DESC`, `DISTINCT`, `DOUBLE`                                                                            |
| E   | `ECSQLOPTIONS`, `ELSE`, `END`, `ESCAPE`, `EVERY`, `EXCEPT`, `EXCLUDE`, `EXISTS`                                                         |
| F   | `FALSE`, `FILTER`, `FIRST`, `FIRST_VALUE`, `FLOAT`, `FOLLOWING`, `FOR`, `FORWARD`, `FROM`, `FULL`                                       |
| G   | `GROUP`, `GROUP_CONCAT`, `GROUPS`, `HAVING`                                                                                             |
| I   | `IIF`, `IN`, `INNER`, `INSERT`, `INT`, `INTEGER`, `INT64`, `INTERSECT`, `INTO`, `IS`                                                    |
| J   | `JOIN`                                                                                                                                  |
| L   | `LAG`, `LAST`, `LAST_VALUE`, `LEAD`, `LEFT`, `LIKE`, `LIMIT`, `LONG`                                                                    |
| M   | `MATCH`, `MAX` ,`MIN`                                                                                                                   |
| N   | `NATURAL`, `NO`, `NOCASE`, `NOT`, `NTH_VALUE`, `NTILE`, `NULL`, `NULLS`                                                                 |
| O   | `OFFSET`, `ON`, `ONLY`, `OPTIONS`, `OR`, `ORDER`, `OTHERS`, `OUTER`, `OVER`                                                             |
| P   | `PARTITION`, `PERCENT_RANK`, `PRAGMA`, `PRECEDING`, `RANGE`, `RANK`, `REAL`, `RECURSIVE`, `RIGHT`, `ROW`, `ROW_NUMBER`, `ROWS`, `RTRIM` |
| S   | `SELECT`, `SET`, `SOME`, `STRING`, `SUM`                                                                                                |
| T   | `THEN`, `TIES`, `TIME`, `TIMESTAMP`, `TOTAL`, `TRUE`                                                                                    |
| U   | `UNBOUNDED`, `UNION`, `UNIQUE`, `UNKNOWN`, `UPDATE`, `USING`                                                                            |
| V   | `VALUE`, `VALUES` ,`VARCHAR`                                                                                                            |
| W   | `WHEN`, `WHERE`, `WINDOW`, `WITH`                                                                                                       |

## Escaping keywords

ECSQL has large set of [keywords](#ecsql-keywords). Keywords sometime appear in query as class name, property name or parameter name, cte block name or aliases and will result in query to fail. To fix it the keyword need to be quoted or escaped. Following is different ways keywords can be escaped. In ECSQL is preferred to escape using square brackets e.g. `[keyword]`.

| Escape            | description                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"_keyword_"**   | A keyword in double-quotes is an identifier.                                                                                                                                              |
| **[_keyword_]**   | A keyword enclosed in square brackets is an identifier. This is not standard SQL. This quoting mechanism is used by MS Access and SQL Server and is included in SQLite for compatibility. |
| **\`_keyword_\`** | A keyword enclosed in grave accents (ASCII code 96) is an identifier. This is not standard SQL. This quoting mechanism is used by MySQL and is included in SQLite for compatibility.      |

> As best practice it good idea to escape at least escape all user defined identifiers like alias and properties name even when they are not currently keywords. They may become keyword in future as ECSQL evolve and may break your query.
