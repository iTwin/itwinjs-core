# First Examples

We will start off the tutorial by a simple ECSQL example:

## First ECSQL

> **Try it yourself**
>
> *Goal:* Return id, subclass and code of all [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#SpatialLocationElement)s in the iModel.
>
> *ECSQL:*
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement
> ```
>
> *Result*
>
> ECInstanceId | ECClassId | CodeValue
> --- | --- | ---
> 0x10000000012 | MyDomain.Building | Building A
> 0x10000000014 | MyDomain.Space | A-G-1
> 0x10000000015 | MyDomain.Space | A-G-2
> 0x10000000017 | MyDomain.Space | A-1-1
> 0x10000000019 | MyDomain.Space | A-2-1
> 0x1000000001a | MyDomain.Space | A-2-2
> 0x1000000001b | MyDomain.Space | A-2-3
> 0x1000000001c | MyDomain.Space | A-2-4
> 0x1000000001d | MyDomain.Space | A-2-5
> 0x1000000001e | MyDomain.Space | A-2-6
> 0x1000000001f | MyDomain.Space | A-2-7
> 0x10000000020 | MyDomain.Space | A-2-8
> 0x10000000013 | MyDomain.Story | A-G
> 0x10000000016 | MyDomain.Story | A-1
> 0x10000000018 | MyDomain.Story | A-2

## Fully qualified class names

The example illustrates an important rule. As an iModel contains more than one ECSchema, class names might be ambiguous. Therefore **the classes used in an ECSQL have to be fully qualified by their schemas**. The schema can either be specified by its name or by its alias.

Syntax: `<Schema name or alias>.<Class name>`

See [ECSQL Reference](../ECSQL.md#fully-qualifying-ecclasses-in-ecsql) for details.

The example from above uses the schema alias. If you replace it by the schema name, you will get the same result as above.

> **Try it yourself**
>
> *Goal:* Return id, subclass and code of all [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#SpatialLocationElement)s in the iModel.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM BisCore.SpatialLocationElement
> ```
>
> *Result:* As in [First ECSQL](#first-ecsql)
>
> ECInstanceId | ECClassId | CodeValue
> --- | --- | ---
> 0x10000000012 | MyDomain.Building | Building A
> 0x10000000014 | MyDomain.Space | A-G-1
> 0x10000000015 | MyDomain.Space | A-G-2
> 0x10000000017 | MyDomain.Space | A-1-1
> 0x10000000019 | MyDomain.Space | A-2-1
> 0x1000000001a | MyDomain.Space | A-2-2
> 0x1000000001b | MyDomain.Space | A-2-3
> 0x1000000001c | MyDomain.Space | A-2-4
> 0x1000000001d | MyDomain.Space | A-2-5
> 0x1000000001e | MyDomain.Space | A-2-6
> 0x1000000001f | MyDomain.Space | A-2-7
> 0x10000000020 | MyDomain.Space | A-2-8
> 0x10000000013 | MyDomain.Story | A-G
> 0x10000000016 | MyDomain.Story | A-1
> 0x10000000018 | MyDomain.Story | A-2

If you omit the schema, you will get an error:

> **Try it yourself**
>
> *Goal:* Return id, subclass and code of all [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#SpatialLocationElement)s in the iModel.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM SpatialLocationElement
> ```
>
> *Result*
>
> `Failed to execute the ECSQL: Invalid ECSQL class expression: Valid syntax: [<table space>.]<schema name or alias>.<class name>`

## Element Count

The above example is not very meaningful. In large iModels the query might return far too many instances. If you want to find out how many [Element](../../bis/domains/BisCore.ecschema.md#Element)s there are in the iModel, you can run the following query.

> **Try it yourself**
>
> *Goal:* Find out how many [Element](../../bis/domains/BisCore.ecschema.md#Element)s there are in the iModel.
>
> *ECSQL*
> ```sql
> SELECT count(*) FROM bis.Element
> ```
>
> *Result*
>
> count(*) |
> --- |
> 80 |

This query considers all kinds of [Element](../../bis/domains/BisCore.ecschema.md#Element)s. If we want to focus only on Elements which represent realworld assets, we can use the BIS class [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s instead.

> **Try it yourself**
>
> *Goal:* Find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s there are in the iModel.
>
> *ECSQL*
> ```sql
> SELECT count(*) FROM bis.SpatialElement
> ```
>
> *Result*
>
> count(*) |
> --- |
> 26 |

Let's compute some more Element statistic with ECSQL. We want to find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s there are in the iModel per actual element type (where element type here refers to the subclasses of the [Element](../../bis/domains/BisCore.ecschema.md#Element) ECClass).

> **Try it yourself**
>
> *Goal:* Find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s there are in the iModel per actual element type.
>
> *ECSQL*
> ```sql
> SELECT ECClassId, count(*) ElementCount FROM bis.SpatialElement GROUP BY ECClassId ORDER BY ECClassId
> ```
>
> *Result*
>
> ECClassId | ElementCount
> --- | ---
> MyDomain.Building | 1
> MyDomain.Device | 11
> MyDomain.Space | 11
> MyDomain.Story | 3

## Limiting the result set

Another way to deal with large query results is to use `LIMIT` and `OFFSET`. See [LIMIT and OFFSET in ECSQL Reference](../ECSQL.md#limit-and-offset) for details.

Let's apply `LIMIT` and `OFFSET` to he first ECSQL example from above ([first ECSQL example](#first-ecsql)) to shrink the returned rows to a more digestible number.

> **Try it yourself**
>
> *Goal:* Return the first 5 [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#SpatialLocationElement)s only.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement LIMIT 5
> ```
> *Result*
>
> ECInstanceId | ECClassId | CodeValue
> --- | --- | ---
> 0x10000000012 | MyDomain.Building | Building A
> 0x10000000014 | MyDomain.Space | A-G-1
> 0x10000000015 | MyDomain.Space | A-G-2
> 0x10000000017 | MyDomain.Space | A-1-1
> 0x10000000019 | MyDomain.Space | A-2-1

---

> **Try it yourself**
>
> *Goal:* Return the 11th through 15th [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#SpatialLocationElement) only.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement LIMIT 5 OFFSET 5
> ```
> *Result*
>
> ECInstanceId | ECClassId | CodeValue
> --- | --- | ---
> 0x1000000001f | MyDomain.Space | A-2-7
> 0x10000000020 | MyDomain.Space | A-2-8
> 0x10000000013 | MyDomain.Story | A-G
> 0x10000000016 | MyDomain.Story | A-1
> 0x10000000018 | MyDomain.Story | A-2

## Formatting the Output

**Aliases** for the expressions in the SELECT clause are a convenient way to format the output of the ECSQL query.

> **Try it yourself**
>
> *Goal:* Find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s there are in the iModel and give the resulting column the more meaningful name *Element Count*.
>
> *ECSQL*
> ```sql
> SELECT count(*) ElementCount FROM bis.SpatialElement
> ```
> *Result*
>
> ElementCount |
> --- |
> 26 |

---

> **Try it yourself**
>
> *Goal:* Return id and code of all [Element](../../bis/domains/BisCore.ecschema.md#Element)s in the iModel and give the id column the name *ElementId* and the code value column the name *Code*.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId ElementId, ECClassId, CodeValue Code FROM bis.Element LIMIT 3
> ```
> *Result*
>
> ElementId | ECClassId | Code
> 0x1 | BisCore.Subject | My Campus
> 0xe | BisCore.LinkPartition | BisCore.RealityDataSources
> 0x10 | BisCore.DefinitionPartition | BisCore.DictionaryModel

One aspect of the power of ECSQL (and SQL) is the richness of expressiveness. Instead of just returning the property values from
some class, you can let ECSQL do calculations. The following example uses ECSQL as a simple calculator.

> **Try it yourself**
>
> *Goal:* Compute the perimeter and area of a circle with a radius of 10 cm.
>
> *ECSQL*
> ```sql
> SELECT 10 Radius, (2 * 3.1415 * 10) Perimeter, (3.1415 * 10 * 10) Area FROM bis.Element LIMIT 1
> ```
> *Result*
>
> Radius | Perimeter | Area
> --- | --- | ---
> 10 | 62.8 | 314.15

Using **aliases** is also helpful when working with the iModel.js API. The API returns query results as JavaScript object literals where
each expression of the SELECT clause becomes the member of the object.

If you, for example, used the [Element Count example](#element-count) with the iModeljs API, you would get this JavaScript object literal:

 ```ts
 { "count(*)" : 26 }
 ```

The power of JavaScript object literals is lost here, because `count(*)` is not a valid member name. If you applied an alias to
the count expression though so that the ECSQL would look like this:

```sql
SELECT count(*) elementCount FROM bis.SpatialElement
```

the JavaScript object would now look like this:

```ts
 { elementCount : 26 }
 ```

Now the result can be consumed in TypeScript as desired:

```ts
 iModelDb.withPreparedStatement("SELECT count(*) elementCount FROM bis.SpatialElement", (stmt: ECSqlStatement) => {
    stmt.step();
    const row: any = stmt.getRow();
    console.log("Element count: " + row.elementCount);
    });
```

## Parametrizing the ECSQL

To reuse the same ECSQL statement with different values, parameters can be used. Reusing ECSQL statements should always be considered because preparing an ECSQL statement can be costly. See the [ECSQL Reference](../ECSQL.md#ecsql-parameters) for details and some examples. Values for the parameters are bound to the statement via the iModel.js API.

**Not binding a value to a parameter is like binding NULL to it.**

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s that do not have a user label.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE UserLabel=? LIMIT 5
> ```
> *Result*
>
> ECInstanceId | ECClassId
> --- | ---
> 0x10000000012 | MyDomain.Building
> 0x10000000021 | MyDomain.Device
> 0x10000000022 | MyDomain.Device
> 0x10000000023 | MyDomain.Device
> 0x10000000024 | MyDomain.Device

As you cannot bind values to parameters in the iModelConsole, the above query returns the same as if you did the following.

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s that do not have a user label.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE UserLabel IS NULL LIMIT 5
> ```
> *Result*
>
> ECInstanceId | ECClassId
> --- | ---
> 0x10000000012 | MyDomain.Building
> 0x10000000021 | MyDomain.Device
> 0x10000000022 | MyDomain.Device
> 0x10000000023 | MyDomain.Device
> 0x10000000024 | MyDomain.Device

## SQL Functions

Any SQL function can be used in ECSQL. This includes functions built into SQLite (see [SQLite Functions overview](https://www.sqlite.org/lang_corefunc.html)) or functions built into iModel.js, like the [geometry functions](../GeometrySqlFuncs.md) which you can use for [spatial queries](../SpatialQueries.md).

> **Try it yourself**
>
> *Goal:* For all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s whose code contains the string 'DEV' return a more human-readable form of the code by replacing 'DEV' by 'Device'.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, CodeValue, replace(CodeValue,'DEV','Device') ReadableCode FROM bis.SpatialElement WHERE instr(CodeValue,'DEV') LIMIT 5
> ```
> *Result*
>
> ECInstanceId | CodeValue | ReadableCode
> --- | --- | ---
> 0x10000000021 | DEV-A-G-1 | Device-A-G-1
> 0x10000000022 | DEV-A-G-2 | Device-A-G-2
> 0x10000000023 | DEV-A-1-1 | Device-A-1-1
> 0x10000000024 | DEV-A-2-1 | Device-A-2-1
> 0x10000000025 | DEV-A-2-2 | Device-A-2-2

The example uses the SQLite functions [replace](https://www.sqlite.org/lang_corefunc.html#replace) to replace the substring 'DEV' in the code and
[instr](https://www.sqlite.org/lang_corefunc.html#instr) to only do this on rows where the code contains the substring 'DEV' at all.

Note, that the `instr` function can be replaced by using the standard SQL `LIKE` operator together with the wildcard `%`.

> **Try it yourself**
>
> *Goal:* For all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s whose code contains the string 'DEV' return a more human-readable form of the code by replacing 'DEV' by 'Device'.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, CodeValue, replace(CodeValue,'DEV','Device') ReadableCode FROM bis.SpatialElement WHERE CodeValue LIKE '%DEV%' LIMIT 5
> ```
> *Result*
>
> ECInstanceId | CodeValue | ReadableCode
> --- | --- | ---
> 0x10000000021 | DEV-A-G-1 | Device-A-G-1
> 0x10000000022 | DEV-A-G-2 | Device-A-G-2
> 0x10000000023 | DEV-A-1-1 | Device-A-1-1
> 0x10000000024 | DEV-A-2-1 | Device-A-2-1
> 0x10000000025 | DEV-A-2-2 | Device-A-2-2
---

[**< Previous**](./KeyToECSQL.md)  &nbsp; | &nbsp; [**Next >**](./ECSQLDataTypes.md)
