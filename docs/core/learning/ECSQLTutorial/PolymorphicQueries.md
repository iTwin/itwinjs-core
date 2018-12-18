# Polymorphic Queries

By default, any ECClass in the FROM or JOIN clause of an ECSQL is treated polymorphically. That means all the subclasses of the specified class are considered as well. If an ECClass should be treated non-polymorphically, i.e. only the class itself and not its subclasses should be considered, add the `ONLY` keyword in front of it.

> This also applies to [Mixins](../../bis/intro/mixins.md). From an ECSQL perspective there is nothing special about mixins because they are technically just ECClasses (abstract Entity ECClasses to be precise). You can simply query against a mixin class without knowing which classes actually implement the mixin.

We begin the lesson by using a simple ECSQL similar to the ones used at the beginning of the tutorial.

> **Try it yourself**
>
> *Goal:* Return the code and class id of all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s.
>
> *ECSQL*
> ```sql
> SELECT CodeValue, ECClassId FROM bis.SpatialElement
> ```
>
> *Result*
>
> CodeValue | ECClassId
> --- | ---
> Building A | MyDomain.Building
> DEV-> A-G-1 | MyDomain.Device
> DEV-> A-G-2 | MyDomain.Device
> DEV-> A-1-1 | MyDomain.Device
> DEV-> A-2-1 | MyDomain.Device
> DEV-> A-2-2 | MyDomain.Device
> DEV-> A-2-3 | MyDomain.Device
> DEV-> A-2-4 | MyDomain.Device
> DEV-> A-2-5 | MyDomain.Device
> DEV-> A-2-6 | MyDomain.Device
> DEV-> A-2-7 | MyDomain.Device
> DEV-> A-2-8 | MyDomain.Device
> DEV-> A-G-4 | MyDomain.Device
> A-G-1 | MyDomain.Space
> A-G-2 | MyDomain.Space
> A-1-1 | MyDomain.Space
> A-2-1 | MyDomain.Space
> A-2-2 | MyDomain.Space
> A-2-3 | MyDomain.Space
> A-2-4 | MyDomain.Space
> A-2-5 | MyDomain.Space
> A-2-6 | MyDomain.Space
> A-2-7 | MyDomain.Space
> A-2-8 | MyDomain.Space
> A-G | MyDomain.Story
> A-1 | MyDomain.Story
> A-2 | MyDomain.Story

This example illustrates that polymorphism is pretty obvious. All examples throughout the tutorial up to here were polymorphic queries, and we did not have to mention or even explain it. It has worked intuitively. If we now take a closer look at what the ECSQL does, you can notice this:

- The [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement) ECClass is an abstract class, i.e. it cannot have any instances. However you can query against it, and because of polymorphism the query intuitively returns instances of all subclasses of `SpatialElement`.
- Returning the [ECClassId](./ECSQLDataTypes.md#ecinstanceid-and-ecclassid) in the query only makes sense because of polymorphism. If the query was not polymorphic, the returned ECClassId would always be the same.
- Consequently, the [ECClassId](./ECSQLDataTypes.md#ecinstanceid-and-ecclassid) is key when you need to know about the subclasses of a polymorphic query.

Now let's turn the query into a non-polymorphic one.

> **Try it yourself**
>
> *Goal:* Return the code and class id of instances of only the [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement) class
>
> *ECSQL*
> ```sql
> SELECT CodeValue, ECClassId FROM ONLY bis.SpatialElement
> ```
>
> *Result*
>
> CodeValue | ECClassId
> --- | ---
> no rows |

As expected the query does not return anything, because [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement) is an abstract class, and hence cannot have any instances. It is more meaningful to query against a non-abstract class.

> **Try it yourself**
>
> *Goal:* Return the code of instances of only the [Device](./MyDomain.ecschema.md#Device) class (which is a subclass of [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement))
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, CodeValue FROM ONLY MyDomain.Device
> ```
>
> *Result*
>
> ECInstanceId | CodeValue
> --- | ---
> 0x10000000020 | DEV-A-G-1
> 0x10000000022 | DEV-A-G-2
> 0x10000000025 | DEV-A-1-1
> 0x10000000028 | DEV-A-2-1
> 0x1000000002a | DEV-A-2-2
> 0x1000000002c | DEV-A-2-3
> 0x1000000002e | DEV-A-2-4
> 0x10000000030 | DEV-A-2-5
> 0x10000000032 | DEV-A-2-6
> 0x10000000034 | DEV-A-2-7
> 0x10000000036 | DEV-A-2-8
> 0x20000000002 | DEV-A-G-4

Let's go back to explore more how to work with the ECClassId to tell between subclasses of a polymorphic query.

> **Try it yourself**
>
> *Goal:* Return the code and class id of all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s that are either [Space](./MyDomain.ecschema.md#Space) (ECClassId 261) or [Story](./MyDomain.ecschema.md#Story) (ECClassId 261) classes.
>
> *ECSQL*
> ```sql
> SELECT CodeValue, ECClassId FROM bis.SpatialElement WHERE ECClassId IN (261,262)
> ```
>
> *Result*
>
> CodeValue | ECClassId
> --- | ---
> A-G-1 | MyDomain.Space
> A-G-2 | MyDomain.Space
> A-1-1 | MyDomain.Space
> A-2-1 | MyDomain.Space
> A-2-2 | MyDomain.Space
> A-2-3 | MyDomain.Space
> A-2-4 | MyDomain.Space
> A-2-5 | MyDomain.Space
> A-2-6 | MyDomain.Space
> A-2-7 | MyDomain.Space
> A-2-8 | MyDomain.Space
> A-G | MyDomain.Story
> A-1 | MyDomain.Story
> A-2 | MyDomain.Story

As usually the class ids are not known, you need to look them up first. You can do so by joining to the [ECDbMeta ECSchema](../ECDbMeta.ecschema.md). This allows you to specify the subclasses by name rather than by id. The [ECDbMeta ECSchema](../ECDbMeta.ecschema.md) is covered in more detail in the advanced lesson about [Meta queries](./MetaQueries.md).

> **Try it yourself**
>
> *Goal:* Return the code and class id of all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s that are either [Space](./MyDomain.ecschema.md#Space) or [Story](./MyDomain.ecschema.md#Story) classes.
>
> *ECSQL*
> ```sql
> SELECT SpatialElement.CodeValue, SpatialElement.ECClassId FROM bis.SpatialElement JOIN meta.ECClassDef ON SpatialElement.ECClassId=ECClassDef.ECInstanceId WHERE ECClassDef.Name IN ('Space','Story')
> ```
>
> *Result*
>
> CodeValue | ECClassId
> --- | ---
> A-G-1 | MyDomain.Space
> A-G-2 | MyDomain.Space
> A-1-1 | MyDomain.Space
> A-2-1 | MyDomain.Space
> A-2-2 | MyDomain.Space
> A-2-3 | MyDomain.Space
> A-2-4 | MyDomain.Space
> A-2-5 | MyDomain.Space
> A-2-6 | MyDomain.Space
> A-2-7 | MyDomain.Space
> A-2-8 | MyDomain.Space
> A-G | MyDomain.Story
> A-1 | MyDomain.Story
> A-2 | MyDomain.Story

The following shows how you can perform simple statistics on the distribution of instances across the [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement) subclasses.

> **Try it yourself**
>
> *Goal:* Return Element count per [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement) subclass for all [SpatialElement](../../bis/domains/BisCore.ecschema.md#SpatialElement)s in the iModel.
>
> *ECSQL*
> ```sql
> SELECT ECClassId, count(*) ElementCount FROM bis.SpatialElement GROUP BY ECClassId
> ```
>
> *Result*
>
> ECClassId | ElementCount
> --- | ---
> MyDomain.Building | 1
> MyDomain.Device | 12
> MyDomain.Space | 11
> MyDomain.Story | 3

---

[**< Previous**](./Joins.md) &nbsp; | &nbsp; [**Next >**](./SpatialQueries.md)