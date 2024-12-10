# Type List Expression

- dataset: AllProperties.bim

```sql
SELECT Instance FROM meta.CustomAttribute WHERE Class.Id IS (AllProperties.TestCAClass) LIMIT 1
```

```json
{
  "columns": [
    {
      "className": "ECDbMeta:CustomAttribute",
      "accessString": "Instance",
      "generated": false,
      "index": 0,
      "jsonName": "instance",
      "name": "Instance",
      "extendedType": "Xml",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "Instance"
    }
  ]
}
```

```json
[
  {
    "Instance": "<TestCAClass xmlns=\"AllProperties.01.00\">\n    <TestCAProp>TestProp</TestCAProp>\n</TestCAClass>\n"
  }
]
```

# Using Bitwise AND

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId = (4 & 5)
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

| ECInstanceId | ECClassId | Name     | Alias | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | -------- | ----- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0x4          | 0x27      | ECDbMeta | meta  | 4            | 0            | 3            | 3                         | 2                         |

# Using Bitwise OR

- dataset: AllProperties.bim

```sql
SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId = (4 | 1)
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

| ECInstanceId | ECClassId | Name       | Description                                 | Alias   | VersionMajor | VersionWrite | VersionMinor | OriginalECXmlVersionMajor | OriginalECXmlVersionMinor |
| ------------ | --------- | ---------- | ------------------------------------------- | ------- | ------------ | ------------ | ------------ | ------------------------- | ------------------------- |
| 0x5          | 0x27      | ECDbSystem | Helper ECSchema for ECDb internal purposes. | ecdbsys | 5            | 0            | 2            | 3                         | 2                         |

# Unary Predicate Expression

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE True
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 0     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 1     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 2     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 3     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 4     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 5     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 6     | bin       | bin          | Json         | string   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 7     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 8     | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin                                | p2d                          | p3d                                        |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| 0x14         | 0x153     | 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x15         | 0x153     | 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x16         | 0x153     | 102 | 1002 | 2.1 | true | 2017-01-01T00:00:00.000 | str2 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x17         | 0x153     | 103 | 1003 | 3.1 | true | 2010-01-01T11:11:11.000 | str3 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x18         | 0x153     | 104 | 1004 | 4.1 | true | 2017-01-01T00:00:00.000 | str4 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x19         | 0x153     | 105 | 1005 | 5.1 | true | 2010-01-01T11:11:11.000 | str5 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x1a         | 0x153     | 106 | 1006 | 6.1 | true | 2017-01-01T00:00:00.000 | str6 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1b         | 0x153     | 107 | 1007 | 7.1 | true | 2010-01-01T11:11:11.000 | str7 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x1c         | 0x153     | 108 | 1008 | 8.1 | true | 2017-01-01T00:00:00.000 | str8 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1d         | 0x153     | 109 | 1009 | 9.1 | true | 2010-01-01T11:11:11.000 | str9 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
