# NULL, NUMBER, STRING & BOOLEAN Literals

ECSQL supports the following primitive types. Not all can be declared as literals in ECSQL, though they can be inserted/updated and queried in ECSQL.

| Type      | Declared in ECSQL | Descriptions                                |
| --------- | ----------------- | ------------------------------------------- |
| `Integer` | Yes               | 32bit integer                               |
| `Long`    | Yes               | 64bit integer                               |
| `Double`  | Yes               | Stored as 8-byte IEEE floating point number |
| `String`  | Yes               | UTF-8 encoded string                        |
| `Boolean` | Yes               | True/False. stored as single byte integer   |
| `Point2d` | No                | _Cannot be declared in ECSQL_               |
| `Point3d` | No                | _Cannot be declared in ECSQL_               |
| `Binary`  | No                | _Cannot be declared in ECSQL_               |

```sql
-- integer / long
SELECT 12344, 0xfffff

-- double
SELECT 1.3, -3.3e-1

-- concatenated string
SELECT 'Hello' || ',' || ' ' || 'World',

-- boolean
SELECT true, false

-- null
SELECT NULL
```

[ECSql Syntax](./index.md)
