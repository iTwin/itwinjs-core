# Common table expression

```
WITH [RECURSIVE] cte-table-name AS ( select-stmt )[,...] primary-select-stmt
```

## What is Common Table Expressions?
Common table expressions or CTEs act like temporary views that exist only for the duration of a single ECSQL statement. There are following two type of CTEs

### Ordinary Common Table Expressions
This is many used to factoring out subqueries and making the overall ECSQL statement easier to read and understand. It contain just a select statement with or without `RECURSIVE` key word.

```sql
  WITH
    el (Id, ClassId) AS (
      SELECT ECInstanceId, ECClassId FROM bis.Element
    ) SELECT * FROM el;
```

### Recursive Common Table Expressions

A recursive common table expression can be used to walk a tree or graph. It is of the
following form.

```
  cte-table-name AS ( initial-select) UNION [ALL] recursive-select)
```

Take simple example to see how we can write a CTE. In following query we want to generate a sequence from 1 through 5. The initial value of x = 1 and then we recursively do x+1 until the value of x is less then 6.

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

Take another example where we like to traverse class hierarchy starting from a class down to all derived classes and generate a path string show where each of them are along with the depth of the derived class w.r.t `GeomerticElement3d`

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
