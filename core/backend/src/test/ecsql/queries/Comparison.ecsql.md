# Less than operator

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE i < 102
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 8     | bin       | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 9     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 10    | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin                                | p2d                          | p3d                                        |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| 0x14         | 0x153     | 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x15         | 0x153     | 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |

# Not equal to operator

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE i != 105
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 8     | bin       | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 9     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 10    | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin                                | p2d                          | p3d                                        |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| 0x14         | 0x153     | 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x15         | 0x153     | 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x16         | 0x153     | 102 | 1002 | 2.1 | true | 2017-01-01T00:00:00.000 | str2 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x17         | 0x153     | 103 | 1003 | 3.1 | true | 2010-01-01T11:11:11.000 | str3 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x18         | 0x153     | 104 | 1004 | 4.1 | true | 2017-01-01T00:00:00.000 | str4 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1a         | 0x153     | 106 | 1006 | 6.1 | true | 2017-01-01T00:00:00.000 | str6 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1b         | 0x153     | 107 | 1007 | 7.1 | true | 2010-01-01T11:11:11.000 | str7 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x1c         | 0x153     | 108 | 1008 | 8.1 | true | 2017-01-01T00:00:00.000 | str8 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1d         | 0x153     | 109 | 1009 | 9.1 | true | 2010-01-01T11:11:11.000 | str9 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |

# Equal to operator

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE i = 104
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 8     | bin       | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 9     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 10    | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin        | p2d                      | p3d                              |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------- | ------------------------ | -------------------------------- |
| 0x18         | 0x153     | 104 | 1004 | 4.1 | true | 2017-01-01T00:00:00.000 | str4 | BIN(1,2,3) | {"X": 1.034, "Y": 2.034} | {"X": -1, "Y": 2.3, "Z": 3.0001} |

# Greater than operator

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE i > 107
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 8     | bin       | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 9     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 10    | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin                                | p2d                          | p3d                                        |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| 0x1c         | 0x153     | 108 | 1008 | 8.1 | true | 2017-01-01T00:00:00.000 | str8 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1d         | 0x153     | 109 | 1009 | 9.1 | true | 2010-01-01T11:11:11.000 | str9 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |

# Less than or Equal to operator

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE i <= 104
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 8     | bin       | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 9     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 10    | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin                                | p2d                          | p3d                                        |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| 0x14         | 0x153     | 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x15         | 0x153     | 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x16         | 0x153     | 102 | 1002 | 2.1 | true | 2017-01-01T00:00:00.000 | str2 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x17         | 0x153     | 103 | 1003 | 3.1 | true | 2010-01-01T11:11:11.000 | str3 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x18         | 0x153     | 104 | 1004 | 4.1 | true | 2017-01-01T00:00:00.000 | str4 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |

# Greater than or Equal to operator

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, i, l, d, b, dt, s, bin, p2d, p3d FROM aps.TestElement WHERE i >= 106
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | -------- | ------------------ |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id       | ECClassId          |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string   | String   | s                  |
| AllProperties:IPrimitive | bin          | false     | 8     | bin       | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:IPrimitive | p2d          | false     | 9     | p2d       | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive | p3d          | false     | 10    | p3d       | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | ECClassId | i   | l    | d   | b    | dt                      | s    | bin                                | p2d                          | p3d                                        |
| ------------ | --------- | --- | ---- | --- | ---- | ----------------------- | ---- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| 0x1a         | 0x153     | 106 | 1006 | 6.1 | true | 2017-01-01T00:00:00.000 | str6 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1b         | 0x153     | 107 | 1007 | 7.1 | true | 2010-01-01T11:11:11.000 | str7 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
| 0x1c         | 0x153     | 108 | 1008 | 8.1 | true | 2017-01-01T00:00:00.000 | str8 | BIN(1,2,3)                         | {"X": 1.034, "Y": 2.034}     | {"X": -1, "Y": 2.3, "Z": 3.0001}           |
| 0x1d         | 0x153     | 109 | 1009 | 9.1 | true | 2010-01-01T11:11:11.000 | str9 | BIN(11,21,31,34,53,21,14,14,55,22) | {"X": 1111.11, "Y": 2222.22} | {"X": -111.11, "Y": -222.22, "Z": -333.33} |
