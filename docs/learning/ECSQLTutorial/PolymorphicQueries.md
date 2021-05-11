# Polymorphic Queries

By default, any ECClass in the FROM or JOIN clause of an ECSQL is treated polymorphically. That means all the subclasses of the specified class are considered as well. If an ECClass should be treated non-polymorphically, i.e. only the class itself and not its subclasses should be considered, add the `ONLY` keyword in front of it.

> This also applies to [Mixins](../../bis/intro/mixins.md). From an ECSQL perspective there is nothing special about mixins because they are technically just ECClasses (abstract Entity ECClasses to be precise). You can simply query against a mixin class without knowing which classes actually implement the mixin.

We begin the lesson by using a simple ECSQL similar to the ones used at the beginning of the tutorial.

> **Try it yourself**
>
> *Goal:* Return the UserLabel and class id of all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s.
>
> *ECSQL*
>
> ```sql
> SELECT UserLabel, ECClassId FROM bis.SpatialElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT UserLabel, ECClassId FROM bis.SpatialElement"></iframe>

This example illustrates that polymorphism is pretty obvious. All examples throughout the tutorial up to here were polymorphic queries, and we did not have to mention or even explain it. It has worked intuitively. If we now take a closer look at what the ECSQL does, you can notice this:

- The [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) ECClass is an abstract class, i.e. it cannot have any instances. However you can query against it, and because of polymorphism the query intuitively returns instances of all subclasses of `SpatialElement`.
- Returning the [ECClassId](./ECSQLDataTypes.md#ecinstanceid-and-ecclassid) in the query only makes sense because of polymorphism. If the query was not polymorphic, the returned ECClassId would always be the same.
- Consequently, the [ECClassId](./ECSQLDataTypes.md#ecinstanceid-and-ecclassid) is key when you need to know about the subclasses of a polymorphic query.

Now let's turn the query into a non-polymorphic one.

> **Try it yourself**
>
> *Goal:* Return the code and class id of instances of only the [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) class
>
> *ECSQL*
>
> ```sql
> SELECT CodeValue, ECClassId FROM ONLY bis.SpatialElement
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT CodeValue, UserLabel FROM ONLY bis.SpatialElement"></iframe>

As expected the query does not return anything, because [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) is an abstract class, and hence cannot have any instances. It is more meaningful to query against a non-abstract class.

> **Try it yourself**
>
> *Goal:* Return the UserLabel of instances of only the Generic.PhysicalObject class (which is a subclass of [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement))
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceid, UserLabel FROM ONLY Generic.PhysicalObject
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECInstanceid, UserLabel FROM ONLY Generic.PhysicalObject"></iframe>

Let's go back to explore more how to work with the ECClassId to tell between subclasses of a polymorphic query.

> **Try it yourself**
>
> *Goal:* Return the userlabel and class id of all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s that are either between ecclassid 0 and 200.
>
> *ECSQL*
>
> ```sql
> SELECT UserLabel, ECClassId FROM bis.SpatialElement WHERE ECClassId BETWEEN 0 AND 200
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT UserLabel, ECClassId FROM bis.SpatialElement WHERE ECClassId BETWEEN 0 AND 200"></iframe>

As usually the class ids are not known, you need to look them up first. You can do so by joining to the [ECDbMeta ECSchema](../ECDbMeta.ecschema.md). This allows you to specify the subclasses by name rather than by id. The [ECDbMeta ECSchema](../ECDbMeta.ecschema.md) is covered in more detail in the advanced lesson about [Meta queries](./MetaQueries.md).

> **Try it yourself**
>
> *Goal:* Return the UserLabel and class id of all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s that are either 'LightLocation' or 'PhysicalObject' classes.
>
> *ECSQL*
>
> ```sql
> SELECT SpatialElement.UserLabel, SpatialElement.ECClassId, ECClassDef.Name  FROM bis.SpatialElement JOIN meta.ECClassDef ON SpatialElement.ECClassId=ECClassDef.ECInstanceId WHERE ECClassDef.Name IN ('LightLocation','PhysicalObject')
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT SpatialElement.UserLabel, SpatialElement.ECClassId, ECClassDef.Name  FROM bis.SpatialElement JOIN meta.ECClassDef ON SpatialElement.ECClassId=ECClassDef.ECInstanceId WHERE ECClassDef.Name IN ('LightLocation','PhysicalObject')"></iframe>

The following shows how you can perform simple statistics on the distribution of instances across the [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) subclasses.

> **Try it yourself**
>
> *Goal:* Return Element count per [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) subclass for all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement)s in the iModel.
>
> *ECSQL*
>
> ```sql
> SELECT ECClassId, count(*) ElementCount FROM bis.SpatialElement GROUP BY ECClassId
> ```
>
<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT ECClassId, count(*) ElementCount FROM bis.SpatialElement GROUP BY ECClassId"></iframe>

---

[**< Previous**](./Joins.md) &nbsp; | &nbsp; [**Next >**](./SpatialQueries.md)
