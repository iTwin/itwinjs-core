# Class Filter Expression

ECSQL allows filters by class

```sql
    <ECClassId>|<expr> IS [NOT] ( [ONLY] <qualified-classname-1> [, [ONLY] <qualified-classname-2>, ...])
```

See [Reference Docs](../ECSqlReference/ECClassFilter.md) for more information on Class Filters

## Example

> **Try it yourself**
>
> _Goal:_ Returns elements only if it's either of class GeometricElement3d, GeometricElement2d, or any of their sub-classes
>
> _ECSQL_
>
> ```sql
> SELECT * FROM bis.Element WHERE ECClassId IS (bis.GeometricElement3d, bis.GeometricElement2d)
> ```

---

> **Try it yourself**
>
> _Goal:_ Returns elements only if it's exactly of the specified classess - sub-classes are not included
>
> _ECSQL_
>
> ```sql
> SELECT * FROM bis.Element WHERE ECClassId IS (ONLY Generic.PhysicalObject, ONLY BisCore.LightLocation)
> ```

---

> **Try it yourself**
>
> _Goal:_ Inverts the selection set
>
> _ECSQL_
>
> ```sql
> SELECT * FROM bis.Element WHERE ECClassId IS NOT (ONLY Generic.PhysicalObject, ONLY BisCore.LightLocation)
> ```

---

[< Previous](./ChangeSummaryQueries.md) &nbsp;
