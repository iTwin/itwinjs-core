
# Type Filter Expression

ECSQL allows filters by type

```sql
    <ECClassId>|<expr> IS [NOT] ( [ONLY] <qualified-classname-1> [, [ONLY] <qualified-classname-2>, ...])
```

### Example

> **Try it yourself**
>
> *Goal:* Returns elements only if it's either of type GeometricElement3d, GeometricElement2d, or any of their sub-classes
>
> *ECSQL*
> ```sql
> SELECT * FROM bis.Element WHERE ECClassId IS (bis.GeometricElement3d, bis.GeometricElement2d
> ```
<iframe style="height:40vh; width:60vw" src="/console/?imodel=Bay Town Process Plant&query=SELECT * FROM bis.Element WHERE ECClassId IS (bis.GeometricElement3d, bis.GeometricElement2d"></iframe>

---

> **Try it yourself**
>
> *Goal:* Returns elements only if it's exactly of the specified types - sub-classes are not included
>
> *ECSQL*
> ```sql
> SELECT * FROM bis.Element WHERE ECClassId IS (ONLY ProcessFunctional.NOZZLE, ONLY ProcessFunctional.VESSEL)
> ```
<iframe style="height:40vh; width:60vw" src="/console/?imodel=Bay Town Process Plant&query=SELECT * FROM bis.Element WHERE ECClassId IS (ONLY ProcessFunctional.NOZZLE, ONLY ProcessFunctional.VESSEL)"></iframe>

---

> **Try it yourself**
>
> *Goal:* Inverts the selection set
>
> *ECSQL*
> ```sql
> SELECT * FROM bis.Element WHERE ECClassId IS NOT (ONLY ProcessFunctional.NOZZLE, ONLY ProcessFunctional.VESSEL)
> ```
<iframe style="height:40vh; width:60vw" src="/console/?imodel=Bay Town Process Plant&query=SELECT * FROM bis.Element WHERE ECClassId IS NOT (ONLY ProcessFunctional.NOZZLE, ONLY ProcessFunctional.VESSEL)"></iframe>

---
