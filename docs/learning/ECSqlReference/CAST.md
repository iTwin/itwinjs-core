# CAST operator

Allow converting primitive value from one type to another.

Syntax: `CAST(<expr> AS [TEXT | INTEGER | REAL | BLOB | TIMESTAMP])`

Example:

```sql
    SELECT CAST(3.14159265 AS TEXT);
    -- 3.14159265
    SELECT CAST('3.14159265' AS REAL);
    -- 3.1416
    SELECT CAST('3.14159265' AS INTEGER);
    -- 3
```

[ECSql Syntax](./index.md)
