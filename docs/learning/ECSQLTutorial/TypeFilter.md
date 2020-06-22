
# Type Filter Expression

ECSQL allows filters by type

```sql
    <ECClassId>|<expr> IS [NOT] ( [ONLY] <qualified-classname-1> [, [ONLY] <qualified-classname-2>, ...])
```

### Example

```sql
-- Returns elements only if it's either of type GeometricElement3d, GeometricElement2d, or any of their sub-classes
SELECT * FROM bis.Element WHERE ECClassId IS (bis.GeometricElement3d, bis.GeometricElement2d)

-- Returns elements only if it's exactly of the specified types - sub-classes are not included
SELECT * FROM bis.Element WHERE ECClassId IS (ONLY opm.PUMP, ONLY opm.VALVE)

-- Inverts the selection set
SELECT * FROM bis.Element WHERE ECClassId IS NOT (ONLY opm.PUMP)

```
