# ECSQL Data Types

## ECInstanceId and ECClassId

ECSQL defines a set of built-in system properties. They don't have to be defined in the ECSchemas (see also [ECSQL reference](../ECSQL.md#ecinstanceid-and-ecclassid)).

Property | Description
--- | ---
ECInstanceId | Is the unique identifier for an ECInstance.
ECClassId | Refers to the ECClassId of an ECClass. It uniquely identifies an ECClass in the iModel.

> In iModelJs the *ECClassId* is formatted as fully qualified class name when used in the SELECT clause.

---

> **Try it yourself**
>
> *Goal:* Return the actual Element subclass of the [Element](../../bis/domains/biscore/BisCore.ecschema.md#SpatialElement) with id 0x10000000021.
>
> *ECSQL*
> ```sql
> SELECT ECClassId, CodeValue FROM bis.Element WHERE ECInstanceId=0x10000000021
> ```
> *Result*
>
> ECClassId | CodeValue
> --- | ---
> MyDomain.Device | DEV-A-G-1

## Primitive Data Types

ECSQL supports all primitive types built into the EC system. This means that in addition to the basic numeric and string data types in SQL-92, ECSQL also supports boolean, BLOBs, date-time and point types.

## Boolean

For Boolean types ECSQL supports the literals `True` and `False`.

> **Try it yourself**
>
> *Goal:* Find out which [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model) are private or not.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId, ECClassId, IsPrivate FROM bis.Model
> ```
> *Result*
>
> ECInstanceId | ECClassId | IsPrivate
> --- | --- | ---
> 0x1 | BisCore.RepositoryModel | false
> 0xe | BisCore.LinkModel | true
> 0x10 | BisCore.DictionaryModel | true
> 0x10000000011 | BisCore.PhysicalModel | false
> 0x10000000030 | BisCore.DocumentListModel | false
> 0x10000000031 | BisCore.DrawingModel | false
> 0x10000000039 | BisCore.DrawingModel | false
> 0x10000000040 | BisCore.DrawingModel | false

Boolean properties or expressions do not need to be compared to `True` and `False` as they return a
boolean value already.

> **Try it yourself**
>
> *Goal:* Find private [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model)s.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE IsPrivate = True
> ```
> and
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE IsPrivate
> ```
> are equivalent.
>
> *Result*
>
> ECInstanceId | ECClassId
> --- | ---
> 0xe | BisCore.LinkModel
> 0x10 | BisCore.DictionaryModel

And the same example with `False`:

> **Try it yourself**
>
> *Goal:* Find non-private [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model)s.
>
> *ECSQL*
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE IsPrivate = False
> ```
> and
> ```sql
> SELECT ECInstanceId,ECClassId FROM bis.Model WHERE NOT IsPrivate
> ```
> are equivalent.
>
> *Result*
>
> ECInstanceId | ECClassId
> --- | ---
> 0x1 | BisCore.RepositoryModel
> 0x10000000011 | BisCore.PhysicalModel
> 0x10000000030 | BisCore.DocumentListModel
> 0x10000000031 | BisCore.DrawingModel
> 0x10000000039 | BisCore.DrawingModel
> 0x10000000040 | BisCore.DrawingModel

## DateTime

ECSQL supports both dates without time (`DATE`) and dates with time (`TIMESTAMP`).

> ECSQL does not support time zone conversions. Time zone conversions are to be handled by the application.

See [ECSQL Reference](../ECSQL.md#datetime) for details.

> **Try it yourself**
>
> *Goal:* Find all [Device](./MyDomain.ecschema.md#Device)s which were modified before June, 1st, 2018.
>
> *ECSQL*
> ```sql
> SELECT CodeValue,LastMod FROM MyDomain.Device WHERE LastMod < DATE '2018-06-01'
> ```
> *Result*
>
> CodeValue | LastMod
> --- | ---
> DEV-A-G-1 | 2018-05-29T13:43:42.185Z
> DEV-A-G-2 | 2018-05-29T13:43:42.186Z
> DEV-A-1-1 | 2018-05-29T19:00:00.029Z
> DEV-A-2-1 | 2018-05-29T19:00:00.029Z

---

> **Try it yourself**
>
> *Goal:* Find all [Device](./MyDomain.ecschema.md#Device)s which were modified between 8am and 6pm UTC on May, 29th 2018.
>
> *ECSQL*
> ```sql
> SELECT CodeValue,LastMod FROM bis.Element WHERE LastMod BETWEEN TIMESTAMP '2018-05-29T08:00:00Z' AND TIMESTAMP '2018-05-29T18:00:00Z'
> ```
> *Result*
>
> CodeValue | LastMod
> --- | ---
> DEV-A-G-1 | 2018-05-29T13:43:42.185Z
> DEV-A-G-2 | 2018-05-29T13:43:42.186Z

## Points

Points are a built-in primitive type of ECSchemas and are therefore supported in ECSQL.

In the context of ECSQL Point ECProperties are interpreted as structs made up of the
following system properties (See [ECSQL Reference](../ECSQL.md#points) for details):

Property | Description
--- | ---
`X` | X coordinate of the Point2d or Point3d
`Y` | Y coordinate of the Point2d or Point3d
`Z` | Z coordinate of the Point3d

> **Try it yourself**
>
> *Goal:* Find all [Device](./MyDomain.ecschema.md#Device)s whose origin lies within the cube with the
> lower corner point (50, 30, 10) and the upper corner point (70, 40, 20).
>
> *ECSQL*
> ```sql
> SELECT CodeValue, Origin FROM MyDomain.Device
> WHERE Origin.X BETWEEN 50 AND 70 AND
> Origin.Y BETWEEN 30 AND 40 AND Origin.Z BETWEEN 10 AND 20
> ```
>
> *Result*
>
> CodeValue | Origin
> --- | ---
> DEV-A-2-6 | {"x":55,"y":35,"z":11}
> DEV-A-2-7 | {"x":65,"y":35,"z":11}

## Navigation Properties

Navigation properties are ECProperties that point to a related object. They are always backed by an ECRelationshipClass.

In the context of ECSQL navigation properties are interpreted as structs made up of the
following system properties (See [ECSQL Reference](../ECSQL.md#navigation-properties) for details):

Property | Description
--- | ---
`Id` | ECInstanceId of the related instance
`RelECClassId` | ECClassId of the ECRelationshipClass backing the navigation property. It is mainly relevant when the ECRelationshipClass has subclasses.

> In iModelJs the *RelECClassId* is formatted as fully qualified class name when used in the SELECT clause.

---

> **Try it yourself**
>
> *Goal:* Return the parent [Element](../../bis/domains/biscore/BisCore.ecschema.md#Element) for the [Space](./MyDomain.ecschema.md#Space) with code value *A-G-2*.
>
> *ECSQL*
> ```sql
> SELECT Parent FROM MyDomain.Space WHERE CodeValue='A-G-2'
> ```
> *Result*
>
> Parent |
> --- |
> {"id":"0x10000000013","relClassName":"BisCore.ElementOwnsChildElements"} |

---

> **Try it yourself**
>
> *Goal:* Return the id of the parent [Element](../../bis/domains/biscore/BisCore.ecschema.md#Element) for the [Space](./MyDomain.ecschema.md#Space) with code value *A-G-2*.
>
> *ECSQL*
> ```sql
> SELECT Parent.Id FROM MyDomain.Space WHERE CodeValue='A-G-2'
> ```
> *Result*
>
> Parent.Id |
> --- |
> 0x10000000013 |

---

> **Try it yourself**
>
> *Goal:* Return the id and RelECClassId of the parent [Element](../../bis/domains/biscore/BisCore.ecschema.md#Element) separately for the [Space](./MyDomain.ecschema.md#Space) with code value *A-G-2*.
>
> *ECSQL*
> ```sql
> SELECT Parent.Id, Parent.RelECClassId FROM MyDomain.Space WHERE CodeValue='A-G-2'
> ```
>
> *Result*
>
> Parent.Id | Parent.RelECClassId
> --- | ---
> 0x10000000013 | BisCore.ElementOwnsChildElements

Find more examples in the lesson about [Joins and ECRelationshipClasses](./Joins.md#examples).

## Structs

In ECSQL you can refer to a struct ECProperty either as a whole or by just referring to some of its members.
The operator for referencing members of structs in an ECSQL is the '.'.

> As there are no struct properties in the sample iModel (structs are generally rarely used), you cannot try that out with this
> tutorial. However, you will find ECSQL examples in the respective section of the [ECSQL Reference](../ECSQL.md#structs).

## Arrays

In ECSQL you can refer to Array ECProperties only as a whole.

> The sample iModel does not use array properties for its data. However, arrays are used when querying ECSchemas.
> That topic is covered as advanced lesson: [Querying ECSchemas (Meta queries)](./MetaQueries.md)
> You will also find ECSQL examples in the respective section of the [ECSQL Reference](../ECSQL.md#arrays).

---

[**< Previous**](./FirstExamples.md) &nbsp; | &nbsp; [**Next >**](./Joins.md)
