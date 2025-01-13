# JOIN

## INNER JOIN

Join to a class or subquery.

Syntax: `[INNER] JOIN <class|subquery> ON <join-expr>`

```sql
SELECT [schema].[Name] [Schema], [class].[Name] [Class]
FROM [meta].[ECClassDef] [class]
    INNER JOIN [meta].[ECSchemaDef] [schema] ON [class].[Schema].[Id] =  [schema].[ECInstanceId]
ORDER BY [schema].[Name], [class].[Name]
LIMIT 4;

/*
Schema              |Class
-----------------------------------------
BisCore             |AnnotationElement2d
BisCore             |AnnotationFrameStyle
BisCore             |AnnotationLeaderStyle
BisCore             |AnnotationTextStyle
*/
```

## OUTER JOIN

Outer joins are joins that return matched values and unmatched values from either or both classes.

There are three type of OUTER JOIN.

1. LEFT JOIN
2. RIGHT JOIN
3. FULL JOIN

### LEFT JOIN

`LEFT JOIN` returns only unmatched rows from the left class, as well as matched rows in both classes

```sql

SELECT * FROM (SELECT null b) t LEFT JOIN  (SELECT 1 b) r ON t.b=r.b;
/*
b        |b_1
----------------------------
NULL     |NULL
*/
```

### RIGHT JOIN

`RIGHT JOIN` returns only unmatched rows from the right class, as well as matched rows in both classes

```sql

SELECT * FROM (SELECT null b) t RIGHT JOIN  (SELECT 1 b) r ON t.b=r.b;
/*
b        |b_1
----------------------------
NULL     |1
*/
```

### FULL JOIN

`FULL JOIN` returns all the rows from both joined classes, whether they have a matching row or not.

```sql
SELECT * FROM (SELECT null b) t FULL JOIN  (SELECT 1 b) r ON t.b=r.b;
/*
b        |b_1
----------------------------
NULL     |NULL
NULL     |1
*/
```

## JOIN USING

Join using automatically uses relationship definition to join two classes

Syntax: `JOIN <end-class> USING <relationship> [FORWARD|BACKWARD]`

In following we join from `Bis.Element` to `BisCore.Element` using `BisCore.ElementOwnsChildElements`. Where child element is `t0` and parent is `t1`. If we use `FORWARD` then `t0` will become child and `t1` will be parent.

```sql
    SELECT *
    FROM [BisCore].[Element] t0
        JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] BACKWARD
```

> NOTE: `JOIN USING` syntax is slower for relationships mapped to a Foreign Key using a Navigation Property than joining directly using the navigation property

[ECSql Syntax](./index.md)
