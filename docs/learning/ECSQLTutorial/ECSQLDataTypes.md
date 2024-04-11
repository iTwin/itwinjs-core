# ECSQL Data Types

## ECInstanceId and ECClassId

ECSQL defines a set of built-in system properties. They don't have to be defined in the ECSchemas (see also [ECSQL reference](../ECSQL.md#ecinstanceid-and-ecclassid)).

| Property     | Description                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| ECInstanceId | Is the unique identifier for an ECInstance.                                             |
| ECClassId    | Refers to the ECClassId of an ECClass. It uniquely identifies an ECClass in the iModel. |

> In iTwin.js the _ECClassId_ is formatted as fully qualified class name when used in the SELECT clause.

---

> **Try it yourself**
>
> _Goal:_ Return the actual Element subclass of the [Element](../../bis/domains/BisCore.ecschema.md#element) with id 0x20000000004.
>
> _ECSQL_
>
> ```sql
> SELECT ECClassId, CodeValue FROM bis.Element WHERE ECInstanceId=0x20000000004
> ```

## Primitive Data Types

ECSQL supports all primitive types built into the EC system. This means that in addition to the basic numeric and string data types in SQL-92, ECSQL also supports boolean, BLOBs, date-time and point types.

## Boolean

For Boolean types ECSQL supports the literals `True` and `False`.

> **Try it yourself**
>
> _Goal:_ Find out which [Model](../../bis/domains/BisCore.ecschema.md#model) are private or not.
>
> _ECSQL_
>
> ```sql
> SELECT ECInstanceId, ECClassId, IsPrivate FROM bis.Model
> ```

Boolean properties or expressions do not need to be compared to `True` and `False` as they return a
boolean value already.

> **Try it yourself**
>
> _Goal:_ Find private [Model](../../bis/domains/BisCore.ecschema.md#model)s.
>
> _ECSQL_
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE IsPrivate = True
> ```
>
> and
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE IsPrivate
> ```
>
> are equivalent.

And the same example with `False`:

> **Try it yourself**
>
> _Goal:_ Find non-private [Model](../../bis/domains/BisCore.ecschema.md#model)s.
>
> _ECSQL_
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE IsPrivate = False
> ```
>
> and
>
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE NOT IsPrivate
> ```

## DateTime

ECSQL supports dates without time (`DATE`), dates with time (`TIMESTAMP`), and times without date (`TIME`).

> ECSQL does not support time zone conversions. Time zone conversions are to be handled by the application.

See [ECSQL Reference](../ECSQL.md#datetime) for details.

> **Try it yourself**
>
> _Goal:_ Find all elements which were modified between 12:30pm and 12:31pm UTC on March, 11th 2020.
>
> _ECSQL_
>
> ```sql
> SELECT ECInstanceId, CodeValue, LastMod FROM bis.Element WHERE LastMod BETWEEN TIMESTAMP '2020-03-11T12:30:20.492Z' AND TIMESTAMP '2020-03-11T12:31:03.494Z'
> ```

## Points

Points are a built-in primitive type of ECSchemas and are therefore supported in ECSQL.

In the context of ECSQL Point ECProperties are interpreted as structs made up of the
following system properties (See [ECSQL Reference](../ECSQL.md#points) for details):

| Property | Description                            |
| -------- | -------------------------------------- |
| `X`      | X coordinate of the Point2d or Point3d |
| `Y`      | Y coordinate of the Point2d or Point3d |
| `Z`      | Z coordinate of the Point3d            |

> **Try it yourself**
>
> _Goal:_ Find all [SpatialElement](../../bis/domains/BisCore.ecschema.md#spatialelement) elements whose origin lies within the cube with the
> lower corner point (0, 0, 0) and the upper corner point (10, 10, 10).
>
> _ECSQL_
>
> ```sql
> SELECT ecinstanceid, Origin FROM bis.spatialelement WHERE Origin.X BETWEEN 0 AND 10 AND Origin.Y BETWEEN 0 AND 10 AND Origin.Z BETWEEN 0 AND 10
> ```

## Navigation Properties

Navigation properties are ECProperties that point to a related object. They are always backed by an ECRelationshipClass.

In the context of ECSQL navigation properties are interpreted as structs made up of the
following system properties (See [ECSQL Reference](../ECSQL.md#navigation-properties) for details):

| Property       | Description                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Id`           | ECInstanceId of the related instance                                                                                                     |
| `RelECClassId` | ECClassId of the ECRelationshipClass backing the navigation property. It is mainly relevant when the ECRelationshipClass has subclasses. |

> In iTwin.js the _RelECClassId_ is formatted as fully qualified class name when used in the SELECT clause.

---

> **Try it yourself**
>
> _Goal:_ Return the parent [Element](../../bis/domains/BisCore.ecschema.md#element) for the element with code value _0x20000000007_.
>
> _ECSQL_
>
> ```sql
> SELECT ECInstanceId, CodeValue, LastMod, Parent FROM bis.Element WHERE ECInstanceId = 0x20000000007
> ```

> **Try it yourself**
>
> _Goal:_ Return the id of the parent [Element](../../bis/domains/BisCore.ecschema.md#element) for the element with id value _0x20000000007_.
>
> _ECSQL_
>
> ```sql
> SELECT ECInstanceId, CodeValue, LastMod, Parent.Id FROM bis.Element WHERE ECInstanceId = 0x20000000007
> ```

---

> **Try it yourself**
>
> _Goal:_ Return the id and RelECClassId of the parent [Element](../../bis/domains/BisCore.ecschema.md#element) separately for the element with id value _0x20000000007_.
>
> _ECSQL_
>
> ```sql
> SELECT Parent.Id, Parent.RelECClassId FROM bis.Element WHERE ECInstanceId = 0x20000000007
> ```

Find more examples in the lesson about [Joins and ECRelationshipClasses](./Joins.md#examples).

## Structs

In ECSQL you can refer to a struct ECProperty either as a whole or by just referring to some of its members.
The operator for referencing members of structs in an ECSQL is the '.'.

The sample iModel does not have struct properties. However, the Change Summaries of the iModel have them.
Follow the steps in the sections [Generate Change Summaries](./ChangeSummaryQueries.md#generate-the-change-summaries) and
[Attach Change Summaries](./ChangeSummaryQueries.md#attach-the-change-summaries), before you run the following queries.

> **Try it yourself**
>
> _Goal:_ Return ChangedInstance struct (of type [InstanceKey](../ECDbChange.ecschema.md#instancekey)) as a whole and OpCode for the InstanceChange object `0x36`.
>
> _ECSQL_
>
> ```sql
> SELECT ChangedInstance,OpCode FROM change.InstanceChange WHERE ECInstanceId=0x36
> ```
>
> _Result_
>
> | ChangedInstance                          | OpCode |
> | ---------------------------------------- | ------ |
> | {"classId":"0x100","id":"0x20000000002"} | Update |

And here is an example where individual members of the struct are used.

> **Try it yourself**
>
> _Goal:_ Return the ids of changed instances (structs of type [InstanceKey](../ECDbChange.ecschema.md#instancekey)) that are [Device](./MyDomain.ecschema.md#device)s (ECClass `0x100`) and the corresponding Change Summary id and OpCode.
>
> _ECSQL_
>
> ```sql
> SELECT Summary.Id,ChangedInstance.Id,OpCode FROM change.InstanceChange WHERE ChangedInstance.ClassId=0x100
> ```
>
> _Result_
>
> | Summary.Id | ChangedInstance.Id | OpCode |
> | ---------- | ------------------ | ------ |
> | 0x1        | 0x20000000001      | Delete |
> | 0x35       | 0x20000000001      | Update |
> | 0x35       | 0x20000000002      | Insert |
> | 0x6c       | 0x20000000001      | Insert |

You can find more ECSQL examples in the respective section of the [ECSQL Reference](../ECSQL.md#structs).

## Arrays

In ECSQL you can refer to Array ECProperties only as a whole.

> **Try it yourself**
>
> _Goal:_ Return the ECEnumeration values for the ECEnumeration SectionType. The ECEnumeration values are stored
> in the array property [ECEnumerationDef.EnumValues](../ECDbMeta.ecschema.md#ecenumerationdef).
>
> _ECSQL_
>
> ```sql
> SELECT Name, EnumValues FROM meta.ECEnumerationDef WHERE Name='SectionType'
> ```

You can find more ECSQL examples in the respective section of the [ECSQL Reference](../ECSQL.md#arrays).

---

[< Previous](./FirstExamples.md) &nbsp; | &nbsp; [Next >](./Joins.md)
