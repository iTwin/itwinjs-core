Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing with hard coded json string with hex ids

- dataset: AllProperties.bim

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet('["0x15", "0x18", "0x19"]') where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing with hard coded json string with decimal ids

- dataset: AllProperties.bim

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet('[21, 24, "25"]') where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing by binding with hex ids

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing by binding with decimal ids for ECSql Statement

- dataset: AllProperties.bim
- bindIdSet 1, [21, 24, 25]
- mode: Statement

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing by binding with decimal ids for ConcurrentQuery

`The purpose of this test is to show that bindIdSet when working with ConcurrentQuery only takes into account hex ids and not decimal ids`

- dataset: AllProperties.bim
- bindIdSet 1, [21, 24, 25]
- mode: ConcurrentQuery

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
