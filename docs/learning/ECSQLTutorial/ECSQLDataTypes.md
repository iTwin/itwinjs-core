---
ignore: true
---
# ECSQL Data Types

## ECInstanceId and ECClassId

ECSQL defines a set of built-in system properties. They don't have to be defined in the ECSchemas (see also [ECSQL reference](../ECSQL#ecinstanceid-and-ecclassid)).

Property | Description
-- | --
ECInstanceId | Is the unique identifier for an ECInstance.
ECClassId | Refers to the ECClassId of an ECClass. It uniquely identifies an ECClass in the iModel.

> In iModelJs the *ECClassId* is formatted as fully qualified class name when used in the SELECT clause.

---

> **Try it yourself**
>
> *Goal:* Return the actual Element subclass of the Element with id 123.
>
> *ECSQL:* `SELECT ECClassId, CodeValue FROM bis.Element WHERE ECInstanceId=123`
>
> *Result*
> ECClassId | CodeValue
> -- | --
> Generic.PhysicalObject | Blue Rod

## Primitive Data Types

ECSQL supports all primitive types built into the EC system. This means that in addition to the basic numeric and string data types in SQL-92, ECSQL also supports boolean, BLOBs, date-time and point types.

## Boolean

For Boolean types ECSQL supports the literals `True` and `False`.

> **Try it yourself**
>
> *Goal:* Find out for which `ViewDefinition3d`s the camera is on or off.
>
> *ECSQL:* `SELECT CodeValue, IsCameraOn FROM bis.ViewDefinition3d`
>
> *Result*
> CodeValue | IsCameraOn
> -- | --
> 1 | True
> 2 | False

Boolean properties or expressions do not need to be compared to `True` and `False` as they return a
boolean value already.

> **Try it yourself**
>
> *Goal:* Find `ViewDefinition3d`s with camera on.
>
> *ECSQL*
>
> `SELECT ECInstanceId,CodeValue FROM bis.ViewDefinition3d WHERE IsCameraOn = True`
>
> and
>
> `SELECT ECInstanceId,CodeValue FROM bis.ViewDefinition3d WHERE IsCameraOn`
>
> are equivalent.
>
> *Result*
>
> ECInstanceId | CodeValue
> -- | --
> 1 | lll
>

And the same example with `False`:

> **Try it yourself**
>
> *Goal:* Find `ViewDefinition3d`s with camera off.
>
> *ECSQL:*
>
> `SELECT ECInstanceId,CodeValue FROM bis.ViewDefinition3d WHERE IsCameraOn = False`
>
> and
>
> `SELECT ECInstanceId,CodeValue FROM bis.ViewDefinition3d WHERE NOT IsCameraOn`
>
> are equivalent.
>
> *Result*
>
> ECInstanceId | CodeValue
> -- | --
> 1 | lll

## DateTime

ECSQL supports both dates without time (`DATE`) and dates with time (`TIMESTAMP`).

> ECSQL does not support time zone conversions. Time zone conversions are to be handled by the application.

See [ECSQL Reference](../ECSQL.md#datetime) for details.

> **Try it yourself**
>
> *Goal:* Find all Elements which were modified after January, 1st, 2018.
>
> *ECSQL:* `SELECT CodeValue,LastMod FROM bis.Element WHERE LastMod > DATE '2018-01-01'`
>
> *Result*
>
> CodeValue | LastMod
> -- | --
> lll | 2018-11-13T00:38:06.374Z
> xxx | 2018-07-15T12:00:00.000Z

---

> **Try it yourself**
>
> *Goal:* Find all Elements which were modified between 8am and 6pm UTC on July, 16th 2018.
>
> *ECSQL:* `SELECT CodeValue,LastMod FROM bis.Element WHERE LastMod BETWEEN TIMESTAMP '2018-07-16T08:00:00Z' AND TIMESTAMP '2018-07-16T18:00:00Z'`
>
> *Result*
>
> CodeValue | LastMod
> -- | --
> lll | 2018-07-16T09:23.100Z
> xxx | 2018-07-16T15:44.321Z

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
> *Goal:* Find all `GeometricElement3d`s whose origin lies within a given cube.
>
> *ECSQL*
>
> `SELECT CodeValue, Origin FROM bis.GeometricElement3d
WHERE Origin.X BETWEEN 3500000.0 AND 3500500.0 AND
Origin.Y BETWEEN 5700000.0 AND 5710000.0 AND Origin.Z BETWEEN 0 AND 100.0`
>
> *Result*
>
> CodeValue | Origin
> -- | --
> lll | {"x":3500010,"y":5700010,"z":0}
> lll | {"x":3500422,"y":5700821,"z":30}

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
> *Goal:* Return the parent Element for the Element with id 123.
>
> *ECSQL:* `SELECT Parent FROM bis.Element WHERE ECInstanceId=123`
>
> *Result*
> Parent |
> -- |
> {"id":"0x4","relClassName":"BisCore.ElementOwnsChildElements"} |

---

> **Try it yourself**
>
> *Goal:* Return the id of the parent Element for the Element with id 123.
>
> *ECSQL:* `SELECT Parent.Id FROM bis.Element WHERE ECInstanceId=123`
>
> *Result*
> Parent.Id |
> -- |
> 0x4 |

---

> **Try it yourself**
>
> *Goal:* Return the id and RelECClassId of the parent Element separately for the Element with id 123.
>
> *ECSQL:* `SELECT Parent.Id, Parent.RelECClassId FROM bis.Element WHERE ECInstanceId=123`
>
> *Result*
> Parent.Id | Parent.RelECClassId
> -- | --
> 0x4 | BisCore.ElementOwnsChildElements

Find more examples in the lesson about [Joins and ECRelationshipClasses](./Joins.md#examples).

## Structs

In ECSQL you can refer to a struct ECProperty either as a whole or by just referring to some of its members.
The operator for referencing members of structs in an ECSQL is the '.'.

> As there are no struct properties in the sample iModel (structs are generally rarely used), you cannot try that out with this
> tutorial. However, you will find ECSQL examples in the respective section of the [ECSQL Reference](../ECSQL#structs).

## Arrays

In ECSQL you can refer to Array ECProperties only as a whole.

> The sample iModel does not use array properties for its data. However, arrays are used when querying ECSchemas.
> That topic is covered as advanced lesson: [Querying ECSchemas (Meta queries)](./MetaQueries)
> You will also find ECSQL examples in the respective section of the [ECSQL Reference](../ECSQL#arrays).
