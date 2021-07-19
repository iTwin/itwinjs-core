# First Examples

We will start off the tutorial by a simple ECSQL example using the "House Sample" imodel:

## First ECSQL

> **Try it yourself**
>
> *Goal:* Return id, subclass and UserLabel of all [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#spatiallocationelement)s in the iModel.
>
> *ECSQL:*
>
> ```sql
> SELECT ECInstanceId, ECClassId, UserLabel FROM bis.SpatialLocationElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, ECClassId, UserLabel FROM bis.SpatialLocationElement"></iframe>

## Fully qualified class names

The example illustrates an important rule. As an iModel contains more than one ECSchema, class names might be ambiguous. Therefore **the classes used in an ECSQL have to be fully qualified by their schemas**. The schema can either be specified by its name or by its alias.

Syntax: `<Schema name or alias>.<Class name>`

See [ECSQL Reference](../ECSQL.md#fully-qualifying-ecclasses-in-ecsql) for details.

The example from above uses the schema alias. If you replace it by the schema name, you will get the same result as above.

> **Try it yourself**
>
> *Goal:* Return id, subclass and UserLabel of all [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#spatiallocationelement)s in the iModel.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, ECClassId, UserLabel FROM BisCore.SpatialLocationElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, ECClassId, UserLabel FROM BisCore.SpatialLocationElement"></iframe>

If you omit the schema, you will get an error:

> **Try it yourself**
>
> *Goal:* Return id, subclass and UserLabel of all [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#spatiallocationelement)s in the iModel.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, ECClassId, UserLabel FROM SpatialLocationElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, ECClassId, UserLabel FROM SpatialLocationElement"></iframe>

## Element Count

The above example is not very meaningful. In large iModels the query might return far too many instances. If you want to find out how many [Element](../../bis/domains/BisCore.ecschema.md#element)s there are in the iModel, you can run the following query.

> **Try it yourself**
>
> *Goal:* Find out how many [Element](../../bis/domains/BisCore.ecschema.md#element)s there are in the iModel.
>
> *ECSQL*
>
> ```sql
> SELECT count(*) FROM bis.Element
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT count(*) FROM bis.Element"></iframe>

This query considers all kinds of [Element](../../bis/domains/BisCore.ecschema.md#element)s. If we want to focus only on Elements which represent realworld assets, we can use the BIS class [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s instead.

> **Try it yourself**
>
> *Goal:* Find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s there are in the iModel.
>
> *ECSQL*
>
> ```sql
> SELECT count(*) FROM bis.SpatialElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT count(*) FROM bis.SpatialElement"></iframe>

Let's compute some more Element statistic with ECSQL. We want to find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s there are in the iModel per actual element type (where element type here refers to the subclasses of the [Element](../../bis/domains/BisCore.ecschema.md#element) ECClass).

> **Try it yourself**
>
> *Goal:* Find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s there are in the iModel per actual element type.
>
> *ECSQL*
>
> ```sql
> SELECT ECClassId, count(*) ElementCount FROM bis.SpatialElement GROUP BY ECClassId ORDER BY ECClassId
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECClassId, count(*) ElementCount FROM bis.SpatialElement GROUP BY ECClassId ORDER BY ECClassId"></iframe>

## Limiting the result set

Another way to deal with large query results is to use `LIMIT` and `OFFSET`. See [LIMIT and OFFSET in ECSQL Reference](../ECSQL.md#limit-and-offset) for details.

Let's apply `LIMIT` and `OFFSET` to he first ECSQL example from above ([first ECSQL example](#first-ecsql)) to shrink the returned rows to a more digestible number.

> **Try it yourself**
>
> *Goal:* Return the first 5 [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#spatiallocationelement)s only.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement LIMIT 5
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement LIMIT 5"></iframe>

---

> **Try it yourself**
>
> *Goal:* Return the 11th through 15th [SpatialLocationElement](../../bis/domains/BisCore.ecschema.md#spatiallocationelement) only.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement LIMIT 5 OFFSET 10
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, ECClassId, CodeValue FROM bis.SpatialLocationElement LIMIT 5 OFFSET 10"></iframe>

## Formatting the Output

**Aliases** for the expressions in the SELECT clause are a convenient way to format the output of the ECSQL query.

> **Try it yourself**
>
> *Goal:* Find out how many [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s there are in the iModel and give the resulting column the more meaningful name *Element Count*.
>
> *ECSQL*
>
> ```sql
> SELECT count(*) ElementCount FROM bis.SpatialElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT count(*) ElementCount FROM bis.SpatialElement"></iframe>

> **Try it yourself**
>
> *Goal:* Return id and code of all [Element](../../bis/domains/BisCore.ecschema.md#element)s in the iModel and give the id column the name *ElementId* and the code value column the name *Code*.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId ElementId, ECClassId, CodeValue Code FROM bis.Element LIMIT 3
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId ElementId, ECClassId, CodeValue Code FROM bis.Element LIMIT 3"></iframe>

One aspect of the power of ECSQL (and SQL) is the richness of expressiveness. Instead of just returning the property values from
some class, you can let ECSQL do calculations. The following example uses ECSQL as a simple calculator.

> **Try it yourself**
>
> *Goal:* Compute the perimeter and area of a circle with a radius of 10 cm.
>
> *ECSQL*
>
> ```sql
> SELECT 10 Radius, (2 * 3.1415 * 10) Perimeter, (3.1415 * 10 * 10) Area FROM bis.Element LIMIT 1
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT 10 Radius, (2 *3.1415* 10) Perimeter, (3.1415 *10* 10) Area FROM bis.Element LIMIT 1"></iframe>

Using **aliases** is also helpful when working with the iTwin.js API. The API returns query results as JavaScript object literals where
each expression of the SELECT clause becomes the member of the object.

If you, for example, used the [Element Count example](#element-count) with the iTwin.js API, you would get this JavaScript object literal:

```ts
{ "count(*)" : 27 }
```

The power of JavaScript object literals is lost here, because `count(*)` is not a valid member name. If you applied an alias to
the count expression though so that the ECSQL would look like this:

```sql
SELECT count(*) elementCount FROM bis.SpatialElement
```

the JavaScript object would now look like this:

```ts
{ elementCount : 27 }
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

To reuse the same ECSQL statement with different values, parameters can be used. Reusing ECSQL statements should always be considered because preparing an ECSQL statement can be costly. See the [ECSQL Reference](../ECSQL.md#ecsql-parameters) for details and some examples. Values for the parameters are bound to the statement via the iTwin.js API.

**Not binding a value to a parameter is like binding NULL to it.**

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s that do not have a user label.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE CodeValue=? LIMIT 5
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE CodeValue=? LIMIT 5"></iframe>

As you cannot bind values to parameters in the iModelConsole, the above query returns the same as if you did the following.

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s that do not have a user label.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE CodeValue = NULL LIMIT 5
> ```
>
> *Result*
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE CodeValue = NULL LIMIT 5"></iframe>

## Comparing to NULL

The above example can be used to mention SQLite's semantics of comparing to NULL (see also <https://www.sqlite.org/nulls.html> ). The rule in SQLite is:

> SQLite evaluates the expression `myProp = NULL` always to `false`, even if the property is unset.

If you want to check whether a property is NULL, i.e. unset, use the `IS NULL` or `IS NOT NULL` expressions.

> **Try it yourself**
>
> *Goal:* Return all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s that do not have a user label.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE UserLabel IS NULL LIMIT 5
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE UserLabel IS NULL LIMIT 5"></iframe>

And to illustrate the difference, the same query using = NULL does not return any rows.

> **Try it yourself**
>
> *Goal:* Illustrate that expressions like `= NULL` are always false.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE UserLabel = NULL LIMIT 5
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId,ECClassId FROM bis.SpatialElement WHERE UserLabel = NULL LIMIT 5"></iframe>

## SQL Functions

Any SQL function can be used in ECSQL. This includes functions built into SQLite (see [SQLite Functions overview](https://www.sqlite.org/lang_corefunc.html)) or functions built into iTwin.js, like the [geometry functions](../GeometrySqlFuncs.md) which you can use for [spatial queries](../SpatialQueries.md).

> **Try it yourself**
>
> *Goal:* For all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s whose userlabel contains the string 'Fabric', return a more descriptive form of the label by replacing 'Fabric' with 'ExpensiveFabric'.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, UserLabel, replace(UserLabel,'Fabric','ExpensiveFabric') ModifiedLabel FROM bis.Element WHERE instr(UserLabel,'Fabric')
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, UserLabel, replace(UserLabel,'Fabric','ExpensiveFabric') ModifiedLabel FROM bis.Element WHERE instr(UserLabel,'Fabric')"></iframe>

The example uses the SQLite functions [replace](https://www.sqlite.org/lang_corefunc.html#replace) to replace the substring 'Plant' in the code and
[instr](https://www.sqlite.org/lang_corefunc.html#instr) to only do this on rows where the code contains the substring 'Plant' at all.

Note, that the `instr` function can be replaced by using the standard SQL `LIKE` operator together with the wildcard `%`.

> **Try it yourself**
>
> *Goal:* For all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s whose userlabel contains the string 'Fabric', return a more descriptive form of the label by replacing 'Fabric' with 'ExpensiveFabric'.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, UserLabel, replace(UserLabel,'Fabric','ExpensiveFabric') ModifiedLabel FROM bis.Element WHERE UserLabel LIKE '%Fabric%'
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceId, UserLabel, replace(UserLabel,'Fabric','ExpensiveFabric') ModifiedLabel FROM bis.Element WHERE UserLabel LIKE '%Fabric%'"></iframe>

---

[**< Previous**](./KeyToECSQL.md)  &nbsp; | &nbsp; [**Next >**](./ECSQLDataTypes.md)
