# Nested Subquery in SELECT Clause

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  (
    SELECT
      MAX(VersionMajor)
    FROM
      ECDbMeta :ECSchemaDef
  ) AS MaxVersionMajor
FROM
  aps.TestElement te
LIMIT
  3
```

| className | accessString    | generated | index | jsonName        | name            | extendedType | typeName | type | originPropertyName |
| --------- | --------------- | --------- | ----- | --------------- | --------------- | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId    | false     | 0     | id              | ECInstanceId    | Id           | long     | Id   | ECInstanceId       |
|           | MaxVersionMajor | true      | 1     | maxVersionMajor | MaxVersionMajor | undefined    | int      | Int  | undefined          |

| ECInstanceId | MaxVersionMajor |
| ------------ | --------------- |
| 0x14         | 5               |
| 0x15         | 5               |
| 0x16         | 5               |

# Subquery in WHERE Clause

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId
FROM
  aps.TestElement te
WHERE
  te.i IN (
    SELECT
      VersionMajor + 100
    FROM
      ECDbMeta :ECSchemaDef
    WHERE
      Alias LIKE 'aps%'
  );
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x15         |

# Subquery in WHERE EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId
FROM
  aps.TestElement te
WHERE
  EXISTS (
    SELECT
      1
    FROM
      ECDbMeta :ECSchemaDef ecs
    WHERE
      ecs.VersionMajor + 100 = te.i
  );
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x15         |
| 0x16         |
| 0x18         |
| 0x19         |

# Subquery in WHERE NOT EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId
FROM
  aps.TestElement te
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      ECDbMeta :ECSchemaDef ecs
    WHERE
      ecs.VersionMajor + 100 = te.i
  )
LIMIT
  3;
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x14         |
| 0x17         |
| 0x1a         |

# Subquery in FROM Clause (Inline View, subquery ref)

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  iv.AliasCount
FROM
  aps.TestElement te
  JOIN (
    SELECT
      VersionMajor,
      COUNT(Alias) AS AliasCount
    FROM
      ECDbMeta :ECSchemaDef
    GROUP BY
      VersionMajor
  ) iv ON te.i = iv.VersionMajor + 100;
```

| className | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|           | AliasCount   | true      | 1     | aliasCount | AliasCount   | undefined    | long     | Int64 | undefined          |

| ECInstanceId | AliasCount |
| ------------ | ---------- |
| 0x15         | 6          |
| 0x16         | 2          |
| 0x18         | 1          |
| 0x19         | 1          |

# CTE subquery

- dataset: AllProperties.bim

```sql
WITH
  VersionAliases AS (
    SELECT
      VersionMajor,
      GROUP_CONCAT(Alias) AS Aliases
    FROM
      ECDbMeta :ECSchemaDef
    GROUP BY
      VersionMajor
  )
SELECT
  te.ECInstanceId,
  va.Aliases
FROM
  aps.TestElement te
  LEFT JOIN VersionAliases va ON te.i + 100 = va.VersionMajor;
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | Aliases      | true      | 1     | aliases  | Aliases      | undefined    | string   | String | undefined          |

| ECInstanceId |
| ------------ |
| 0x14         |
| 0x15         |
| 0x16         |
| 0x17         |
| 0x18         |
| 0x19         |
| 0x1a         |
| 0x1b         |
| 0x1c         |
| 0x1d         |

# ANY Clause

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId
FROM
  aps.TestElement te
WHERE
  te.DirectDouble > ANY(
    SELECT
      VersionMajor
    FROM
      ECDbMeta :ECSchemaDef
    WHERE
      Alias LIKE 'bis%'
  )
LIMIT
  3;
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x15         |
| 0x16         |
| 0x17         |

# Nested Subquery with HAVING clause

- dataset: AllProperties.bim

```sql
SELECT
  VersionMajor,
  COUNT(*) AS VersionMajorCount
FROM
  meta.ECSchemaDef s
GROUP BY
  VersionMajor
HAVING
  COUNT(*) > (
    SELECT
      AVG(VersionMinorCount)
    FROM
      (
        SELECT
          VersionMinor,
          COUNT(*) AS VersionMinorCount
        FROM
          meta.ECSchemaDef
        GROUP BY
          VersionMinor
      ) sub
  );
```

| className            | accessString      | generated | index | jsonName          | name              | extendedType | typeName | type  | originPropertyName |
| -------------------- | ----------------- | --------- | ----- | ----------------- | ----------------- | ------------ | -------- | ----- | ------------------ |
| ECDbMeta:ECSchemaDef | VersionMajor      | false     | 0     | versionMajor      | VersionMajor      | undefined    | int      | Int   | VersionMajor       |
|                      | VersionMajorCount | true      | 1     | versionMajorCount | VersionMajorCount | undefined    | long     | Int64 | undefined          |

| VersionMajor | VersionMajorCount |
| ------------ | ----------------- |
| 1            | 6                 |
| 2            | 2                 |

# multiple nested subquery in WHERE clause

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId
FROM
  aps.TestElement te
WHERE
  te.ECInstanceId IN (
    SELECT
      te_inner.ECInstanceId
    FROM
      aps.TestElement te_inner
    WHERE
      te_inner.DirectLong > (
        SELECT
          AVG(VersionMajor)
        FROM
          ECDbMeta :ECSchemaDef
        WHERE
          Alias = (
            SELECT
              Alias
            FROM
              ECDbMeta :ECSchemaDef
            LIMIT
              1
          )
      )
  );
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x14         |
| 0x15         |
| 0x16         |
| 0x17         |
| 0x18         |
| 0x19         |
| 0x1a         |
| 0x1b         |
| 0x1c         |
| 0x1d         |

# Testing Point2d x coord value using select subquery

- dataset: AllProperties.bim
- skip: true

```sql
select p2d.X from (select * from( select p2d from tmp))
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | p2d.X        | false     | 0     | X        | X    |              | double   | Double |

| X     |
| ----- |
| 1.034 |

`Note:- This query causes a crash on the backend so skipping it for now but documenting the behaviour`
