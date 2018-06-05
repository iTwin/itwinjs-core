---
ignore: true
---
# Polymorphic Queries

By default, any ECClass in the FROM or JOIN clause of an ECSQL is treated polymorphically. That means all the subclasses of the specified class are considered as well. If an ECClass should be treated non-polymorphically, i.e. only the class itself and not its subclasses should be considered, add the `ONLY` keyword in front of it.

We begin the lesson by using a simple ECSQL similar to the ones used at the beginning of the tutorial.

> **Try it yourself**
>
> *Goal:* Return the id and class id of all Elements
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId FROM bis.Element
> ```
>
> *Result*
> ECInstanceId | ECClassId
> --- | ---
> lll | XX
> xxx | YY
> xxx | ZZ

This example illustrates that polymorphism is pretty obvious. All examples throughout the tutorial up to here were polymorphic queries, and we did not have to mention or even explain it. It has worked intuitively. If we now take a closer look at what the ECSQL does, you can notice this:

- The `Element` ECClass is an abstract class, i.e. it cannot have any instances. However you can query against it, and because of polymorphism the query intuitively returns instances of all subclasses of `Element`.
- Returning the [ECClassId](./ECSQLDataTypes.md#ecinstanceid-and-ecclassid) in the query only makes sense because of polymorphism. If the query was not polymorphic, the returned ECClassId would always be the same.
- Consequently, the [ECClassId](./ECSQLDataTypes.md#ecinstanceid-and-ecclassid) is key when you need to know about the subclasses of a polymorphic query.

Now let's turn the query into a non-polymorphic one.

> **Try it yourself**
>
> *Goal:* Return the id and class id of instances of only the Element class
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId FROM ONLY bis.Element
> ```
>
> *Result*
> ECInstanceId | ECClassId
> --- | ---
> no rows |

As expected the query does not return anything, because `Element` is an abstract class, and hence cannot have any instances. It is more meaningful to query against a non-abstract class.

> **Try it yourself**
>
> *Goal:* Return the code of instances of only the Subject class (which is a subclass of Element)
>
> *ECSQL*
> ```sql
> SELECT CodeValue FROM ONLY bis.Subject
> ```
>
> *Result*
> CodeValue |
> --- |
> My demo file |

Let's go back to explore more how to work with the ECClassId to tell between subclasses of a polymorphic query.

> **Try it yourself**
>
> *Goal:* Return the code and class id of all Elements that are either XX or YY or ZZ classes.
>
> *ECSQL*
> ```sql
> SELECT CodeValue, ECClassId FROM bis.Element WHERE ECClassId IN (123,134,512)
> ```
>
> *Result*
> CodeValue | ECClassId
> --- | ---
> lll | XX
> xxx | XX
> xxx | YY

As usually the class ids are not known, you need to look them up first. You can do so by joining to the `ECDbMeta` ECSchema. This allows you to specify the subclasses by name rather than by id. The `ECDbMeta` ECSchema is covered in more detail in the advanced lesson about [Meta queries](./MetaQueries).

> **Try it yourself**
>
> *Goal:* Return the code and class id of all Elements that are either XX or YY or ZZ classes.
>
> *ECSQL*
> ```sql
> SELECT Element.CodeValue, Element.ECClassId FROM bis.Element JOIN meta.ECClassDef ON Element.ECClassId=ECClassDef.ECInstanceId WHERE ECClassDef.Name IN ('XX','YY','ZZ')
> ```
>
> *Result*
> CodeValue | ECClassId
> --- | ---
> lll | XX
> xxx | XX
> xxx | YY

The following shows how you can perform simple statistics on the distribution of instances across the Element subclasses.

> **Try it yourself**
>
> *Goal:* Return Element count per Element subclass for all Elements in the iModel.
>
> *ECSQL*
> ```sql
> SELECT ECClassId, count(*) ElementCount FROM bis.Element GROUP BY ECClassId
> ```
>
> *Result*
> ECClassId | ElementCount
> --- | ---
> XX | 10
> YY | 100
> ZZ | 15

---

**< Previous** [Lession 4: Relationships and Joins](./Joins.md) &nbsp; **Next >** [Lesson 6: Spatial Queries](./SpatialQueries.md)