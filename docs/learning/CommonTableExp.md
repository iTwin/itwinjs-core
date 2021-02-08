# Common table expression

```
WITH [RECURSIVE] cte-table-name AS ( select-stmt )[,...] primary-select-stmt
```

## What are Common Table Expressions?
Common table expressions ("CTEs") act like temporary views that exist only for the duration of a single ECSQL statement. There are two types of CTE:

### Ordinary Common Table Expressions
This is mainly used to factor out subqueries, making the overall ECSQL statement easier to read and understand. It contains just a `SELECT` statement with or without `RECURSIVE` keyword.

```sql
  WITH
    el (Id, ClassId) AS (
      SELECT ECInstanceId, ECClassId FROM bis.Element
    ) SELECT * FROM el;
```

### Recursive Common Table Expressions

A recursive common table expression can be used to walk a tree or graph. It is of the following form:

```
  cte-table-name AS ( initial-select) UNION [ALL] recursive-select)
```

Here is a simple example of how we can write a CTE. In the following query we want to generate a sequence from 1 through 5. We start with an initial value of x = 1 and then recursively do x+1 until the value of x is less then 6.

```sql
  WITH RECURSIVE
    cnt (x) AS (
        SELECT 1
        UNION ALL
        SELECT x+1 FROM cnt WHERE x<6
    )
  SELECT * from cnt;

-- output
  x
  ------
  1
  2
  3
  4
  5
  6
```

As another example, we might want to traverse a class hierarchy starting from a base class down to all derived classes, generating a row for each class. Each row should could contain 2 columns: the depth of the derived class relative to the base class and a path string describing its relationship to the base class. Using `BisCore:GeometricElement2d` as the base class produces the following ECSQL and resultant output:

```sql
WITH RECURSIVE
      base_classes (aId, aParentId, aPath, aDepth) AS (
          SELECT c.ECInstanceId, NULL, c.Name, 0  FROM meta.ECClassDef c WHERE c.Name='GeometricElement2d'
          UNION ALL
          SELECT c.ECInstanceId, cbc.TargetECInstanceId, aPath || '/' || c.Name, aDepth + 1
              FROM meta.ECClassDef c
                  JOIN meta.ClassHasBaseClasses cbc ON cbc.SourceECInstanceId = c.ECInstanceId
                  JOIN base_classes  ON aId = cbc.TargetECInstanceId
      )
  SELECT bc.aDepth depth, bc.aPath FROM base_classes bc
	JOIN meta.ECClassDef a ON a.ECInstanceId= bc.aId
	JOIN meta.ECClassDef b ON b.ECInstanceId= bc.aParentId;;

-- output
depth | aPath
---------------------------------------
1     | GeometricElement2d/GraphicalElement2d
2     | GeometricElement2d/GraphicalElement2d/AnnotationElement2d
2     | GeometricElement2d/GraphicalElement2d/DrawingGraphic
2     | GeometricElement2d/GraphicalElement2d/ViewAttachment
2     | GeometricElement2d/GraphicalElement2d/DetailingSymbol
3     | GeometricElement2d/GraphicalElement2d/AnnotationElement2d/TextAnnotation2d
3     | GeometricElement2d/GraphicalElement2d/DrawingGraphic/SheetBorder
3     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/Callout
3     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/TitleText
3     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/ViewAttachmentLabel
4     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/Callout/DetailCallout
4     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/Callout/ElevationCallout
4     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/Callout/PlanCallout
4     | GeometricElement2d/GraphicalElement2d/DetailingSymbol/Callout/SectionCalloutt
```
