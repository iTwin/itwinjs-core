# Select all properties from TestElement which is between 2 Numeric value expression

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId BETWEEN 1 and 3
```

| className            | accessString              | generated | index | jsonName                  | name                      | extendedType | typeName | type   | originPropertyName        |
| -------------------- | ------------------------- | --------- | ----- | ------------------------- | ------------------------- | ------------ | -------- | ------ | ------------------------- |
|                      | ECInstanceId              | false     | 0     | id                        | ECInstanceId              | Id           | long     | Id     | ECInstanceId              |
|                      | ECClassId                 | false     | 1     | className                 | ECClassId                 | ClassId      | long     | Id     | ECClassId                 |
| ECDbMeta:ECSchemaDef | Name                      | false     | 2     | name                      | Name                      | undefined    | string   | String | Name                      |
| ECDbMeta:ECSchemaDef | DisplayLabel              | false     | 3     | displayLabel              | DisplayLabel              | undefined    | string   | String | DisplayLabel              |
| ECDbMeta:ECSchemaDef | Description               | false     | 4     | description               | Description               | undefined    | string   | String | Description               |
| ECDbMeta:ECSchemaDef | Alias                     | false     | 5     | alias                     | Alias                     | undefined    | string   | String | Alias                     |
| ECDbMeta:ECSchemaDef | VersionMajor              | false     | 6     | versionMajor              | VersionMajor              | undefined    | int      | Int    | VersionMajor              |
| ECDbMeta:ECSchemaDef | VersionWrite              | false     | 7     | versionWrite              | VersionWrite              | undefined    | int      | Int    | VersionWrite              |
| ECDbMeta:ECSchemaDef | VersionMinor              | false     | 8     | versionMinor              | VersionMinor              | undefined    | int      | Int    | VersionMinor              |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMajor | false     | 9     | originalECXmlVersionMajor | OriginalECXmlVersionMajor | undefined    | int      | Int    | OriginalECXmlVersionMajor |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMinor | false     | 10    | originalECXmlVersionMinor | OriginalECXmlVersionMinor | undefined    | int      | Int    | OriginalECXmlVersionMinor |

| ECInstanceId | ECClassId | Name                 | DisplayLabel           | Description                                                                                                            | Alias   | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0x1          | 0x27      | CoreCustomAttributes | Core Custom Attributes | Custom attributes to indicate core EC concepts, may include struct classes intended for use in core custom attributes. | CoreCA  | 1            | 0            | 4            | 3                         | 2                         |
| 0x2          | 0x27      | ECDbMap              | ECDb DB Mapping        | Custom attributes that customize ECDb's ECSchema to database mapping.                                                  | ecdbmap | 2            | 0            | 4            | 3                         | 2                         |
| 0x3          | 0x27      | ECDbFileInfo         | ECDb FileInfo          | ECDb FileInfo                                                                                                          | ecdbf   | 2            | 0            | 1            | 3                         | 2                         |

# Select all properties from TestElement which is Not between 2 Numeric value expression

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId NOT BETWEEN 1 and 9
```

| className            | accessString              | generated | index | jsonName                  | name                      | extendedType | typeName | type   | originPropertyName        |
| -------------------- | ------------------------- | --------- | ----- | ------------------------- | ------------------------- | ------------ | -------- | ------ | ------------------------- |
|                      | ECInstanceId              | false     | 0     | id                        | ECInstanceId              | Id           | long     | Id     | ECInstanceId              |
|                      | ECClassId                 | false     | 1     | className                 | ECClassId                 | ClassId      | long     | Id     | ECClassId                 |
| ECDbMeta:ECSchemaDef | Name                      | false     | 2     | name                      | Name                      | undefined    | string   | String | Name                      |
| ECDbMeta:ECSchemaDef | DisplayLabel              | false     | 3     | displayLabel              | DisplayLabel              | undefined    | string   | String | DisplayLabel              |
| ECDbMeta:ECSchemaDef | Description               | false     | 4     | description               | Description               | undefined    | string   | String | Description               |
| ECDbMeta:ECSchemaDef | Alias                     | false     | 5     | alias                     | Alias                     | undefined    | string   | String | Alias                     |
| ECDbMeta:ECSchemaDef | VersionMajor              | false     | 6     | versionMajor              | VersionMajor              | undefined    | int      | Int    | VersionMajor              |
| ECDbMeta:ECSchemaDef | VersionWrite              | false     | 7     | versionWrite              | VersionWrite              | undefined    | int      | Int    | VersionWrite              |
| ECDbMeta:ECSchemaDef | VersionMinor              | false     | 8     | versionMinor              | VersionMinor              | undefined    | int      | Int    | VersionMinor              |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMajor | false     | 9     | originalECXmlVersionMajor | OriginalECXmlVersionMajor | undefined    | int      | Int    | OriginalECXmlVersionMajor |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMinor | false     | 10    | originalECXmlVersionMinor | OriginalECXmlVersionMinor | undefined    | int      | Int    | OriginalECXmlVersionMinor |

| ECInstanceId | ECClassId | Name          | Alias | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | ------------- | ----- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0xa          | 0x27      | AllProperties | aps   | 1            | 0            | 0            | 3                         | 2                         |

# ECSQL supports implicit conversion from string to number for ECInstanceId

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId BETWEEN '1' and '3'
```

| className            | accessString              | generated | index | jsonName                  | name                      | extendedType | typeName | type   | originPropertyName        |
| -------------------- | ------------------------- | --------- | ----- | ------------------------- | ------------------------- | ------------ | -------- | ------ | ------------------------- |
|                      | ECInstanceId              | false     | 0     | id                        | ECInstanceId              | Id           | long     | Id     | ECInstanceId              |
|                      | ECClassId                 | false     | 1     | className                 | ECClassId                 | ClassId      | long     | Id     | ECClassId                 |
| ECDbMeta:ECSchemaDef | Name                      | false     | 2     | name                      | Name                      | undefined    | string   | String | Name                      |
| ECDbMeta:ECSchemaDef | DisplayLabel              | false     | 3     | displayLabel              | DisplayLabel              | undefined    | string   | String | DisplayLabel              |
| ECDbMeta:ECSchemaDef | Description               | false     | 4     | description               | Description               | undefined    | string   | String | Description               |
| ECDbMeta:ECSchemaDef | Alias                     | false     | 5     | alias                     | Alias                     | undefined    | string   | String | Alias                     |
| ECDbMeta:ECSchemaDef | VersionMajor              | false     | 6     | versionMajor              | VersionMajor              | undefined    | int      | Int    | VersionMajor              |
| ECDbMeta:ECSchemaDef | VersionWrite              | false     | 7     | versionWrite              | VersionWrite              | undefined    | int      | Int    | VersionWrite              |
| ECDbMeta:ECSchemaDef | VersionMinor              | false     | 8     | versionMinor              | VersionMinor              | undefined    | int      | Int    | VersionMinor              |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMajor | false     | 9     | originalECXmlVersionMajor | OriginalECXmlVersionMajor | undefined    | int      | Int    | OriginalECXmlVersionMajor |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMinor | false     | 10    | originalECXmlVersionMinor | OriginalECXmlVersionMinor | undefined    | int      | Int    | OriginalECXmlVersionMinor |

| ECInstanceId | ECClassId | Name                 | DisplayLabel           | Description                                                                                                            | Alias   | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0x1          | 0x27      | CoreCustomAttributes | Core Custom Attributes | Custom attributes to indicate core EC concepts, may include struct classes intended for use in core custom attributes. | CoreCA  | 1            | 0            | 4            | 3                         | 2                         |
| 0x2          | 0x27      | ECDbMap              | ECDb DB Mapping        | Custom attributes that customize ECDb's ECSchema to database mapping.                                                  | ecdbmap | 2            | 0            | 4            | 3                         | 2                         |
| 0x3          | 0x27      | ECDbFileInfo         | ECDb FileInfo          | ECDb FileInfo                                                                                                          | ecdbf   | 2            | 0            | 1            | 3                         | 2                         |

# ECSQL supports implicit conversion from string to number for ECInstanceId

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId NOT BETWEEN '1' and '9'
```

| className            | accessString              | generated | index | jsonName                  | name                      | extendedType | typeName | type   | originPropertyName        |
| -------------------- | ------------------------- | --------- | ----- | ------------------------- | ------------------------- | ------------ | -------- | ------ | ------------------------- |
|                      | ECInstanceId              | false     | 0     | id                        | ECInstanceId              | Id           | long     | Id     | ECInstanceId              |
|                      | ECClassId                 | false     | 1     | className                 | ECClassId                 | ClassId      | long     | Id     | ECClassId                 |
| ECDbMeta:ECSchemaDef | Name                      | false     | 2     | name                      | Name                      | undefined    | string   | String | Name                      |
| ECDbMeta:ECSchemaDef | DisplayLabel              | false     | 3     | displayLabel              | DisplayLabel              | undefined    | string   | String | DisplayLabel              |
| ECDbMeta:ECSchemaDef | Description               | false     | 4     | description               | Description               | undefined    | string   | String | Description               |
| ECDbMeta:ECSchemaDef | Alias                     | false     | 5     | alias                     | Alias                     | undefined    | string   | String | Alias                     |
| ECDbMeta:ECSchemaDef | VersionMajor              | false     | 6     | versionMajor              | VersionMajor              | undefined    | int      | Int    | VersionMajor              |
| ECDbMeta:ECSchemaDef | VersionWrite              | false     | 7     | versionWrite              | VersionWrite              | undefined    | int      | Int    | VersionWrite              |
| ECDbMeta:ECSchemaDef | VersionMinor              | false     | 8     | versionMinor              | VersionMinor              | undefined    | int      | Int    | VersionMinor              |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMajor | false     | 9     | originalECXmlVersionMajor | OriginalECXmlVersionMajor | undefined    | int      | Int    | OriginalECXmlVersionMajor |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMinor | false     | 10    | originalECXmlVersionMinor | OriginalECXmlVersionMinor | undefined    | int      | Int    | OriginalECXmlVersionMinor |

| ECInstanceId | ECClassId | Name          | Alias | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | ------------- | ----- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0xa          | 0x27      | AllProperties | aps   | 1            | 0            | 0            | 3                         | 2                         |

# Select all properties from TestElement which is between 2 String value expression

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE Alias BETWEEN 'bis' and 'CoreCA'
```

| className            | accessString              | generated | index | jsonName                  | name                      | extendedType | typeName | type   | originPropertyName        |
| -------------------- | ------------------------- | --------- | ----- | ------------------------- | ------------------------- | ------------ | -------- | ------ | ------------------------- |
|                      | ECInstanceId              | false     | 0     | id                        | ECInstanceId              | Id           | long     | Id     | ECInstanceId              |
|                      | ECClassId                 | false     | 1     | className                 | ECClassId                 | ClassId      | long     | Id     | ECClassId                 |
| ECDbMeta:ECSchemaDef | Name                      | false     | 2     | name                      | Name                      | undefined    | string   | String | Name                      |
| ECDbMeta:ECSchemaDef | DisplayLabel              | false     | 3     | displayLabel              | DisplayLabel              | undefined    | string   | String | DisplayLabel              |
| ECDbMeta:ECSchemaDef | Description               | false     | 4     | description               | Description               | undefined    | string   | String | Description               |
| ECDbMeta:ECSchemaDef | Alias                     | false     | 5     | alias                     | Alias                     | undefined    | string   | String | Alias                     |
| ECDbMeta:ECSchemaDef | VersionMajor              | false     | 6     | versionMajor              | VersionMajor              | undefined    | int      | Int    | VersionMajor              |
| ECDbMeta:ECSchemaDef | VersionWrite              | false     | 7     | versionWrite              | VersionWrite              | undefined    | int      | Int    | VersionWrite              |
| ECDbMeta:ECSchemaDef | VersionMinor              | false     | 8     | versionMinor              | VersionMinor              | undefined    | int      | Int    | VersionMinor              |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMajor | false     | 9     | originalECXmlVersionMajor | OriginalECXmlVersionMajor | undefined    | int      | Int    | OriginalECXmlVersionMajor |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMinor | false     | 10    | originalECXmlVersionMinor | OriginalECXmlVersionMinor | undefined    | int      | Int    | OriginalECXmlVersionMinor |

| ECInstanceId | ECClassId | Name                 | DisplayLabel           | Description                                                                                                            | Alias  | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0x8          | 0x27      | BisCore              | BIS Core               | The BIS core schema contains classes that all other domain schemas extend.                                             | bis    | 1            | 0            | 16           | 3                         | 2                         |
| 0x6          | 0x27      | BisCustomAttributes  | BIS Custom Attributes  | Custom attributes to indicate BIS concepts.                                                                            | bisCA  | 1            | 0            | 0            | 3                         | 2                         |
| 0x1          | 0x27      | CoreCustomAttributes | Core Custom Attributes | Custom attributes to indicate core EC concepts, may include struct classes intended for use in core custom attributes. | CoreCA | 1            | 0            | 4            | 3                         | 2                         |

# Select all properties from TestElement which is Not between 2 String value expression

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE Alias NOT BETWEEN 'bis' and 'CoreCA'
```

| className            | accessString              | generated | index | jsonName                  | name                      | extendedType | typeName | type   | originPropertyName        |
| -------------------- | ------------------------- | --------- | ----- | ------------------------- | ------------------------- | ------------ | -------- | ------ | ------------------------- |
|                      | ECInstanceId              | false     | 0     | id                        | ECInstanceId              | Id           | long     | Id     | ECInstanceId              |
|                      | ECClassId                 | false     | 1     | className                 | ECClassId                 | ClassId      | long     | Id     | ECClassId                 |
| ECDbMeta:ECSchemaDef | Name                      | false     | 2     | name                      | Name                      | undefined    | string   | String | Name                      |
| ECDbMeta:ECSchemaDef | DisplayLabel              | false     | 3     | displayLabel              | DisplayLabel              | undefined    | string   | String | DisplayLabel              |
| ECDbMeta:ECSchemaDef | Description               | false     | 4     | description               | Description               | undefined    | string   | String | Description               |
| ECDbMeta:ECSchemaDef | Alias                     | false     | 5     | alias                     | Alias                     | undefined    | string   | String | Alias                     |
| ECDbMeta:ECSchemaDef | VersionMajor              | false     | 6     | versionMajor              | VersionMajor              | undefined    | int      | Int    | VersionMajor              |
| ECDbMeta:ECSchemaDef | VersionWrite              | false     | 7     | versionWrite              | VersionWrite              | undefined    | int      | Int    | VersionWrite              |
| ECDbMeta:ECSchemaDef | VersionMinor              | false     | 8     | versionMinor              | VersionMinor              | undefined    | int      | Int    | VersionMinor              |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMajor | false     | 9     | originalECXmlVersionMajor | OriginalECXmlVersionMajor | undefined    | int      | Int    | OriginalECXmlVersionMajor |
| ECDbMeta:ECSchemaDef | OriginalECXmlVersionMinor | false     | 10    | originalECXmlVersionMinor | OriginalECXmlVersionMinor | undefined    | int      | Int    | OriginalECXmlVersionMinor |

| ECInstanceId | ECClassId | Name               | DisplayLabel         | Description                                                                                                                                                   | Alias   | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0x2          | 0x27      | ECDbMap            | ECDb DB Mapping      | Custom attributes that customize ECDb's ECSchema to database mapping.                                                                                         | ecdbmap | 2            | 0            | 4            | 3                         | 2                         |
| 0x3          | 0x27      | ECDbFileInfo       | ECDb FileInfo        | ECDb FileInfo                                                                                                                                                 | ecdbf   | 2            | 0            | 1            | 3                         | 2                         |
| 0x4          | 0x27      | ECDbMeta           | undefined            | undefined                                                                                                                                                     | meta    | 4            | 0            | 3            | 3                         | 2                         |
| 0x5          | 0x27      | ECDbSystem         | undefined            | Helper ECSchema for ECDb internal purposes.                                                                                                                   | ecdbsys | 5            | 0            | 2            | 3                         | 2                         |
| 0x7          | 0x27      | ECDbSchemaPolicies | ECDb Schema Policies | Schema policies which impose schema authoring rules.                                                                                                          | ecdbpol | 1            | 0            | 1            | 3                         | 2                         |
| 0x9          | 0x27      | Generic            | undefined            | This schema contains classes that are completely generic. These classes should only be used when there is not enough context to pick something more specific. | generic | 1            | 0            | 5            | 3                         | 2                         |
| 0xa          | 0x27      | AllProperties      | undefined            | undefined                                                                                                                                                     | aps     | 1            | 0            | 0            | 3                         | 2                         |

# Select all properties from TestElement which is between 2 Datetime value expression

- dataset: AllProperties.bim

```sql
SELECT
  i,
  l,
  d,
  b,
  dt,
  s,
  bin,
  p2d,
  p3d
FROM
  aps.TestElement
WHERE
  dt BETWEEN DATE '2017-01-01' AND DATE  '2017-01-01'
LIMIT
  2
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 1     | l        | l    | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 2     | d        | d    | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 3     | b        | b    | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 4     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 5     | s        | s    | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 6     | bin      | bin  | Json         | string   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 7     | p2d      | p2d  | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 8     | p3d      | p3d  | undefined    | point3d  | Point3d  | p3d                |

| i   | l    | d   | b    | dt                      | s    | bin   | p2d             | p3d             |
| --- | ---- | --- | ---- | ----------------------- | ---- | ----- | --------------- | --------------- |
| 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 | 1,2,3 | [object Object] | [object Object] |
| 102 | 1002 | 2.1 | true | 2017-01-01T00:00:00.000 | str2 | 1,2,3 | [object Object] | [object Object] |

# Select all properties from TestElement which is Not between 2 Datetime value expression

- dataset: AllProperties.bim

```sql
SELECT
  i,
  l,
  d,
  b,
  dt,
  s,
  bin,
  p2d,
  p3d
FROM
  aps.TestElement
WHERE
  dt NOT BETWEEN DATE '2017-01-01' AND DATE  '2017-01-01'
LIMIT
  2
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 1     | l        | l    | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 2     | d        | d    | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 3     | b        | b    | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 4     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 5     | s        | s    | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 6     | bin      | bin  | Json         | string   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 7     | p2d      | p2d  | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 8     | p3d      | p3d  | undefined    | point3d  | Point3d  | p3d                |

| i   | l    | d   | b    | dt                      | s    | bin                           | p2d             | p3d             |
| --- | ---- | --- | ---- | ----------------------- | ---- | ----------------------------- | --------------- | --------------- |
| 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 | 11,21,31,34,53,21,14,14,55,22 | [object Object] | [object Object] |
| 103 | 1003 | 3.1 | true | 2010-01-01T11:11:11.000 | str3 | 11,21,31,34,53,21,14,14,55,22 | [object Object] | [object Object] |

# Select all properties from TestElement which is between 2 Datetime value expression

- dataset: AllProperties.bim

```sql
SELECT
  i,
  l,
  d,
  b,
  dt,
  s,
  bin,
  p2d,
  p3d
FROM
  aps.TestElement
WHERE
  dt BETWEEN TIMESTAMP '2017-01-01 00:00:00' AND TIMESTAMP  '2017-01-01 00:00:00'
LIMIT
  2
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 1     | l        | l    | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 2     | d        | d    | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 3     | b        | b    | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 4     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 5     | s        | s    | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 6     | bin      | bin  | Json         | string   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 7     | p2d      | p2d  | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 8     | p3d      | p3d  | undefined    | point3d  | Point3d  | p3d                |

| i   | l    | d   | b    | dt                      | s    | bin   | p2d             | p3d             |
| --- | ---- | --- | ---- | ----------------------- | ---- | ----- | --------------- | --------------- |
| 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 | 1,2,3 | [object Object] | [object Object] |
| 102 | 1002 | 2.1 | true | 2017-01-01T00:00:00.000 | str2 | 1,2,3 | [object Object] | [object Object] |

# Select all properties from TestElement which is Not between 2 Datetime value expression

- dataset: AllProperties.bim

```sql
SELECT
  i,
  l,
  d,
  b,
  dt,
  s,
  bin,
  p2d,
  p3d
FROM
  aps.TestElement
WHERE
  dt NOT BETWEEN TIMESTAMP '2017-01-01 00:00:00' AND TIMESTAMP  '2017-01-01 00:00:00'
LIMIT
  2
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 1     | l        | l    | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 2     | d        | d    | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 3     | b        | b    | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 4     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 5     | s        | s    | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 6     | bin      | bin  | Json         | string   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 7     | p2d      | p2d  | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 8     | p3d      | p3d  | undefined    | point3d  | Point3d  | p3d                |

| i   | l    | d   | b    | dt                      | s    | bin                           | p2d             | p3d             |
| --- | ---- | --- | ---- | ----------------------- | ---- | ----------------------------- | --------------- | --------------- |
| 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 | 11,21,31,34,53,21,14,14,55,22 | [object Object] | [object Object] |
| 103 | 1003 | 3.1 | true | 2010-01-01T11:11:11.000 | str3 | 11,21,31,34,53,21,14,14,55,22 | [object Object] | [object Object] |
