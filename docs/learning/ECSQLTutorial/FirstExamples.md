---
ignore: true
---
# First Examples

We will start off the tutorial by a simple ECSQL example:

## First ECSQL

> **Try it yourself**
>
> *Goal:* Return all Elements in the iModel.
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM bis.Element`
>
> *Result*
> ECInstanceId | CodeValue
> -- | --
> 1 | BlueRow

## Fully qualified class names

The example illustrates an important rule. As an iModel contains more than one ECSchema, class names might be ambiguous. Therefore **the classes used in an ECSQL have to be fully qualified by their schemas**. The schema can either be specified by its name or by its alias.

Syntax: `<Schema name or alias>.<Class name>`

See [ECSQL Reference](../ECSQL.md#fully-qualifying-ecclasses-in-ecsql) for details.

The example from above uses the schema alias. If you replace it by the schema name, you will get the same result as above.

> **Try it yourself**
>
> *Goal:* Return all Elements in the iModel.
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM BisCore.Element`
>
> *Result:* As in [First ECSQL](#first-ecsql)

If you omit the schema, you will get an error:

> **Try it yourself**
>
> *Goal:* Return all Elements in the iModel.
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM Element`
>
> *Result:*
> `Failed to execute the ECSQL: Invalid ECSQL class expression: Valid syntax: [<table space>.]<schema name or alias>.<class name>`

## Element Count

The above example is not very meaningful. In large iModels the query might return far too many instances. If you want to find out how many Elements there are in the iModel, you can run the following query.

> **Try it yourself**
>
> *Goal:* Find out how many Elements there are in the iModel.
>
> *ECSQL:* `SELECT COUNT(*) FROM bis.Element`
>
> *Result*
>
> COUNT(*) |
> -- |
> 10 |

## Limiting the result set

Another way to deal with large query results is to use `LIMIT` and `OFFSET`. See [LIMIT and OFFSET in ECSQL Reference](../ECSQL.md#limit-and-offset) for details.

> **Try it yourself**
>
> *Goal:* Return the first 50 Elements only.
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM bis.Element LIMIT 50`

---

> **Try it yourself**
>
> *Goal:* Return the 201st through 250th Element only.
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM bis.Element LIMIT 50 OFFSET 200`

## Formatting the Output

**Aliases** for the expressions in the SELECT clause are a convenient way to format the output of the ECSQL query.

> **Try it yourself**
>
> *Goal:* Find out how many Elements there are in the iModel and give the resulting column the more meaningful name *Element Count*.
>
> *ECSQL:* `SELECT COUNT(*) ElementCount FROM bis.Element`
>
> *Result*
>
> ElementCount |
> -- |
> 10 |

---

> **Try it yourself**
>
> *Goal:* Return id and code of all Elements in the iModel and give the id column the name *ElementId* and the code value column the name *Code*.
>
> *ECSQL:* `SELECT ECInstanceId ElementId, CodeValue Code FROM bis.Element`
>
> *Result*
>
> ElementId | Code
> -- | --
> 10 | lll

One aspect of the power of ECSQL (and SQL) is the richness of expressiveness. Instead of just returning the property values from
some class, you can let ECSQL do calculations. The following example uses ECSQL as a simple calculator.

> **Try it yourself**
>
> *Goal:* Compute the perimeter and area of a circle with a radius of 10 cm.
>
> *ECSQL:* `SELECT 10 Radius, (2 * 3.1415 * 10) Perimeter, (3.1415 * 10 * 10) Area FROM bis.Element LIMIT 1`
>
> *Result*
>
> Radius | Perimeter | Area
> -- | -- | --
> 10 | 62.8 | 314.15

Using **aliases** is also helpful when working with the iModelJs API. The API returns query results as JavaScript object literals where
each expression of the SELECT clause becomes the member of the object.

If you, for example, used the [Element Count example](#element-count) with the iModeljs API, you would get this JavaScript object literal:

 ```ts
 { "cOUNT(*)" : 10}
 ```

The power of JavaScript object literals is lost here, because `count(*)` is not a valid member name. If you applied an alias to
the count expression though

`SELECT COUNT(*) elementCount FROM bis.Element`

the JavaScript object would now look like this:

```ts
 { elementCount : 10}
 ```

Now the result can be consumed in TypeScript as desired:

```ts
 iModelDb.withPreparedStatement("SELECT count(*) elementCount FROM bis.Element", (stmt: ECSqlStatement) => {
    stmt.step();
    const row: any = stmt.getRow();
    console.log("Element count: " + row.elementCount);
    });
```

## Parametrizing the ECSQL

To reuse the same ECSQL statement with different values, parameters can be used. Reusing ECSQL statements should always be considered because preparing an ECSQL statement can be costly. See the [ECSQL Reference](../ECSQL.md#ecsql-parameters) for details and some examples. Values for the parameters are bound to the statement via the iModelJs API.

**Not binding a value to a parameter is like binding NULL to it.**

> **Try it yourself**
>
> *Goal:* Return all Models that do not have a parent Model.
>
> *ECSQL:* `SELECT ECInstanceId,ECClassId FROM bis.Model WHERE ParentModel=?`
>
> *Result*
>
> ECInstanceId | ECClassId
> -- | --
> 0x1 | BisCore.RepositoryModel

As you cannot bind values to parameters in the iModelConsole, the above query returns the same as if you did the following.

> **Try it yourself**
>
> *Goal:* Return all Models that do not have a parent Model.
>
> *ECSQL:* `SELECT ECInstanceId FROM bis.Model WHERE ParentModel IS NULL`
>
> *Result*
>
> ECInstanceId | ECClassId
> -- | --
> 0x1 | BisCore.RepositoryModel

## SQL Functions

Any SQL function can be used in ECSQL. This includes functions built into SQLite (see [SQLite Functions overview](https://www.sqlite.org/lang_corefunc.html)) or functions built into iModelJs, like the [geometry functions](../GeometrySqlFuncs.md) which you can use for [spatial queries](../SpatialQueries.md).

> **Try it yourself**
>
> *Goal:* Return all Elements whose UserLabel contains the string 'Recreation'
>
> *ECSQL:* `SELECT ECInstanceId, CodeValue FROM bis.Element WHERE instr(UserLabel,'Recreation')`
>
> *Result*
>
> ECInstanceId | CodeValue
> -- | --
> lll | XX
> xxx | YY
> xxx | ZZ
