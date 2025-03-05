# Testing Enum prop of backing type int

- dataset: AllProperties.bim

```sql
SELECT EnumIntProp from aps.TestElement limit 4
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName                  | type | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | ------------------------- | ---- | ------------------ |
| AllProperties:TestElement | EnumIntProp  | false     | 0     | enumIntProp | EnumIntProp | undefined    | AllProperties.TestIntEnum | Int  | EnumIntProp        |

| EnumIntProp |
| ----------- |
| 1           |
| 2           |
| 1           |
| 2           |

# Testing Enum prop of backing type string

- dataset: AllProperties.bim

```sql
SELECT EnumStringProp from aps.TestElement limit 4
```

| className                 | accessString   | generated | index | jsonName       | name           | extendedType | typeName                     | type   | originPropertyName |
| ------------------------- | -------------- | --------- | ----- | -------------- | -------------- | ------------ | ---------------------------- | ------ | ------------------ |
| AllProperties:TestElement | EnumStringProp | false     | 0     | enumStringProp | EnumStringProp | undefined    | AllProperties.TestStringEnum | String | EnumStringProp     |

| EnumStringProp |
| -------------- |
| "1"            |
| "2"            |
| "1"            |
| "2"            |

# Testing Enum array prop of backing type string

- dataset: AllProperties.bim

```sql
SELECT EnumStringPropArr from aps.TestElement limit 4
```

| className                 | accessString      | generated | index | jsonName          | name              | extendedType | typeName                     | type           | originPropertyName |
| ------------------------- | ----------------- | --------- | ----- | ----------------- | ----------------- | ------------ | ---------------------------- | -------------- | ------------------ |
| AllProperties:TestElement | EnumStringPropArr | false     | 0     | enumStringPropArr | EnumStringPropArr | undefined    | AllProperties.TestStringEnum | PrimitiveArray | EnumStringPropArr  |

| EnumStringPropArr |
| ----------------- |
| ["1", "2", "3"]   |
| ["1", "2", "3"]   |
| ["1", "2", "3"]   |
| ["1", "2", "3"]   |

# Testing Enum array prop of backing type int

- dataset: AllProperties.bim

```sql
SELECT EnumIntPropArr from aps.TestElement limit 4
```

| className                 | accessString   | generated | index | jsonName       | name           | extendedType | typeName                  | type           | originPropertyName |
| ------------------------- | -------------- | --------- | ----- | -------------- | -------------- | ------------ | ------------------------- | -------------- | ------------------ |
| AllProperties:TestElement | EnumIntPropArr | false     | 0     | enumIntPropArr | EnumIntPropArr | undefined    | AllProperties.TestIntEnum | PrimitiveArray | EnumIntPropArr     |

| EnumIntPropArr |
| -------------- |
| [1, 2, 3]      |
| [1, 2, 3]      |
| [1, 2, 3]      |
| [1, 2, 3]      |

# Testing Enum prop of backing type int with enumValueExp in where clause

- dataset: AllProperties.bim

```sql
SELECT EnumIntProp from aps.TestElement where EnumIntProp = aps.TestIntEnum.One limit 2
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName                  | type | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | ------------------------- | ---- | ------------------ |
| AllProperties:TestElement | EnumIntProp  | false     | 0     | enumIntProp | EnumIntProp | undefined    | AllProperties.TestIntEnum | Int  | EnumIntProp        |

| EnumIntProp |
| ----------- |
| 1           |
| 1           |

# Testing Enum prop of backing type int with enumValueExp in where clause

- dataset: AllProperties.bim

```sql
SELECT EnumIntProp from aps.TestElement where EnumIntProp <= aps.TestIntEnum.Two limit 4
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName                  | type | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | ------------------------- | ---- | ------------------ |
| AllProperties:TestElement | EnumIntProp  | false     | 0     | enumIntProp | EnumIntProp | undefined    | AllProperties.TestIntEnum | Int  | EnumIntProp        |

| EnumIntProp |
| ----------- |
| 1           |
| 2           |
| 1           |
| 2           |

# Testing Enum prop of backing type string with enumValueExp in where clause

- dataset: AllProperties.bim

```sql
SELECT EnumStringProp from aps.TestElement where EnumStringProp = aps.TestStringEnum.One limit 2
```

| className                 | accessString   | generated | index | jsonName       | name           | extendedType | typeName                     | type   | originPropertyName |
| ------------------------- | -------------- | --------- | ----- | -------------- | -------------- | ------------ | ---------------------------- | ------ | ------------------ |
| AllProperties:TestElement | EnumStringProp | false     | 0     | enumStringProp | EnumStringProp | undefined    | AllProperties.TestStringEnum | String | EnumStringProp     |

| EnumStringProp |
| -------------- |
| "1"            |
| "1"            |

# Testing Enum prop of backing type string with enumValueExp in where clause

- dataset: AllProperties.bim

```sql
SELECT EnumStringProp from aps.TestElement where EnumStringProp >= aps.TestStringEnum.One limit 4
```

| className                 | accessString   | generated | index | jsonName       | name           | extendedType | typeName                     | type   | originPropertyName |
| ------------------------- | -------------- | --------- | ----- | -------------- | -------------- | ------------ | ---------------------------- | ------ | ------------------ |
| AllProperties:TestElement | EnumStringProp | false     | 0     | enumStringProp | EnumStringProp | undefined    | AllProperties.TestStringEnum | String | EnumStringProp     |

| EnumStringProp |
| -------------- |
| "1"            |
| "2"            |
| "1"            |
| "2"            |
