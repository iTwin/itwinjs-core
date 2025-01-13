# GROUP BY clause

Syntax: `GROUP BY <expr-list> [HAVING <group-filter-expr]`

## Count instances of each type of class.

### Query

```sql
    SELECT EC_CLASSNAME([ECClassId]) [ClassName], COUNT(*) [InstanceCount]
    FROM [BisCore].[Element]
    GROUP BY [ECClassId]
    LIMIT 3
```

### Result

| ClassName                   | InstanceCount |
| --------------------------- | ------------- |
| BisCore:DrawingCategory     | 328           |
| BisCore:AnnotationTextStyle | 22            |
| BisCore:AuxCoordSystem2d    | 2s            |


## Count instances of each type of class by filter out group with count less then 10.

### Query

```sql
    SELECT EC_CLASSNAME([ECClassId]) [ClassName], COUNT(*) [InstanceCount]
    FROM [BisCore].[Element]
    GROUP BY [ECClassId]
    HAVING COUNT(*)>10
    LIMIT 3;
```

### Result

| ClassName                   | InstanceCount |
| --------------------------- | ------------- |
| BisCore:DrawingCategory     | 328           |
| BisCore:AnnotationTextStyle | 22            |
| BisCore:CategorySelector    | 313           |

[ECSql Syntax](./index.md)
