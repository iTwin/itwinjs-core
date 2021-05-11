# ECSQL

> Make sure to check out the [ECSQL Tutorial](./ECSQLTutorial/index.md) as well!

## What is ECSQL

ECSQL is a text-based command language for CRUD (create, read, update, delete) operations against
the business data in an iModel or ECDb file.

ECSQL is an implementation of SQL — a proven, well-adopted text-based command language. It adheres to
standard SQL (SQL-92 and SQL-99) wherever possible.

Especially the SQL-99 standard came with a lot of features ECSchemas have too: boolean, date time, binary
data types, structs, arrays, polymorphism. This allows ECSQL to deviate only in very few exceptions from
standard SQL.

Anyone familiar with SQL should intuitively understand ECSQL.

The **key difference between ECSQL and SQL** is that ECSQL targets the *logical* schema, and not the
underlying database’s *persistence* schema.

![ECSQL versus SQL](./ecsql_vs_sql.png "ECSQL versus SQL")

## ECSQL in detail

This is not a comprehensive documentation of the SQL subset of ECSQL. This document only describes the exceptions
to standard SQL and the cases where less known features of the standard are used.
Standard SQL refers to SQL-92 (aka SQL 2), and to SQL-99 (aka SQL 3) whenever SQL-92 is not sufficient.

> All ECSQL examples in the following sections refer to classes and relationships from the [BisCore](../bis/domains/BisCore.ecschema.md) ECSchema (unless mentioned otherwise).

## Fully qualifying ECClasses in ECSQL

The classes used in an ECSQL have to be fully qualified by their schemas.

Syntax: `<Schema name or alias>.<Class name>`

> Instead of '.' you can also use ':' as delimiter between schema and class name.

### Example

The following examples are equivalent. This one uses the schema name:

```sql
SELECT Model, CodeValue, Parent FROM BisCore.Element
```

And this one uses the schema alias:

```sql
SELECT Model, CodeValue, Parent FROM bis.Element
```

## ECSQL Parameters

To bind values to an ECSQL statement after preparation, the following parameter placeholders are
supported.

Parameter type | Description
--- | ---
`?` | Positional parameter. Its index is one greater than the previous parameter in the ECSQL statement.
`:aaa` | Named parameter. This allows to bind the same value to more than one placeholder.

### Example

```sql
SELECT ECInstanceId FROM bis.GeometricElement3d WHERE Model=? AND LastMod>=?
```

```sql
SELECT ECInstanceId FROM bis.GeometricElement3d LIMIT :pagesize OFFSET (:pageno * :pagesize)
```

See also sections [ECInstanceId and ECClassId](#ecinstanceid-and-ecclassid) and [LIMIT and OFFSET](#limit-and-offset).

## ECInstanceId and ECClassId

ECSQL defines a set of built-in system properties. They don't have to be defined in the ECSchemas.

Property | Description
-- | --
ECInstanceId | Is the unique identifier for an ECInstance.
ECClassId | Refers to the ECClassId of an ECClass. It uniquely identifies an ECClass in the iModel.

> In iTwin.js the *ECClassId* is formatted as fully qualified class name when used in the SELECT clause.

### Example

```sql
SELECT Parent, ECClassId FROM bis.Element WHERE ECInstanceId=123
```

## Basic data types in ECSQL

ECSQL supports all primitive types built into EC. This means that in addition to the basic numeric and string data types in SQL-92, ECSQL also supports boolean, BLOBs, date-times and points.

### Boolean

For Boolean types ECSQL supports the literals `True` and `False`.

#### Examples

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.ViewDefinition3d WHERE IsCameraOn = True
```

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.ViewDefinition3d WHERE IsCameraOn = False
```

Boolean properties or expressions do not need to be compared to `True` and `False` as they return a
boolean value already. So the above examples can also be written like this:

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.ViewDefinition3d WHERE IsCameraOn
```

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.ViewDefinition3d WHERE NOT IsCameraOn
```

### DateTime

ECSQL supports dates without time (`DATE`), dates with time (`TIMESTAMP`), and times without date (`TIME`).

> ECSQL does not support time zone conversions. Time zone conversions are to be handled by the application.

#### Literals

`DATE 'yyyy-mm-dd'`

`TIMESTAMP 'yyyy-mm-dd hh:mm:ss[.nnn][Z]'`

`TIME 'hh:mm:ss[.nnn]'`

The time stamp format matches the [ISO 8601 standard](https://www.iso.org/iso-8601-date-and-time-format.html) (see also <https://en.wikipedia.org/wiki/ISO_8601>)

#### Basic functions

Function | Description
--- | ---
`CURRENT_DATE` | returns the current date
`CURRENT_TIMESTAMP` | returns the current timestamp in UTC.
`CURRENT_TIME` | returns the current time of the day.

#### Example

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.Element WHERE LastMod > DATE '2018-01-01'
```

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.Element WHERE LastMod < TIMESTAMP '2017-07-15T12:00:00.000Z'`
```

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.Element WHERE LastMod BETWEEN :startperiod AND :endperiod`
```

```sql
SELECT ECInstanceId FROM myschema.CalenderEntry WHERE startTime >= TIME '08:30:00' AND startTime <= TIME '09:00:00'
```

The last example is based on this ECSchema snippet:

```xml
<ECEntityClass typeName="CalenderEntry">
  <ECProperty propertyName="startTime" typeName="dateTime">
    <ECCustomAttributes>
      <DateTimeInfo xmlns="CoreCustomAttributes.01.00.01">
        <DateTimeComponent>TimeOfDay</DateTimeComponent>
      </DateTimeInfo>
    </ECCustomAttributes>
  </ECProperty>
  <ECProperty propertyName="endTime" typeName="dateTime">
    <ECCustomAttributes>
      <DateTimeInfo xmlns="CoreCustomAttributes.01.00.01">
        <DateTimeComponent>TimeOfDay</DateTimeComponent>
      </DateTimeInfo>
    </ECCustomAttributes>
  </ECProperty>
</ECEntityClass>
```

### Points

Points are a built-in primitive type in ECSchemas and are therefore supported in ECSQL.

In the context of ECSQL Point ECProperties are interpreted as structs made up of the
following system properties:

Property | Description
--- | ---
X | X coordinate of the Point2d or Point3d
Y | Y coordinate of the Point2d or Point3d
Z | Z coordinate of the Point3d

#### Example

```sql
SELECT ECInstanceId, Model, CodeValue FROM bis.GeometricElement3d
WHERE Origin.X BETWEEN 3500000.0 AND 3500500.0 AND
Origin.Y BETWEEN 5700000.0 AND 5710000.0 AND
Origin.Z BETWEEN 0 AND 100.0
```

## Structs

In ECSQL you can refer to a struct ECProperty either as a whole or by just referring to some of its members.
The operator for referencing members of structs in an ECSQL is the '.'.

### Examples

ECSQL | Description
--- | ---
`SELECT Location FROM myschema.Company WHERE Name='ACME'` | Returns the Location struct property as a whole
`SELECT Name,Location.Street,Location.City FROM myschema.Company WHERE ECInstanceId=?` | Returns the Street and City members of the Location struct property
`SELECT Name FROM myschema.Company WHERE Location=?` | Returns rows that match the bound Location value. The Location must be bound as a whole.
`SELECT Name FROM myschema.Company WHERE Location.Zip=12314` | Returns rows that match the Location's Zip member value

based on this ECSchema snippet:

```xml
<ECStructClass typeName="Address">
  <ECProperty propertyName="Street" typeName="string" />
  <ECProperty propertyName="City" typeName="string" />
  <ECProperty propertyName="Zip" typeName="int" />
</ECStructClass>
<ECEntityClass typeName="Company">
  <ECProperty propertyName="Name" typeName="string" />
  <ECArrayProperty propertyName="Location" typeName="Address" />
</ECEntityClass>
```

## Arrays

In ECSQL you can refer to Array ECProperties only as a whole.

### Examples

ECSQL | Description
--- | ---
`SELECT PhoneNumbers FROM myschema.Company WHERE Name='ACME'` | Returns the PhoneNumbers array of the ACME company
`SELECT Name FROM myschema.Company WHERE PhoneNumbers=?` | Returns the companies that match the bound PhoneNumber array. The array must be bound as a whole.

based on this ECSchema snippet:

```xml
<ECEntityClass typeName="Company">
  <ECProperty propertyName="Name" typeName="string" />
  <ECArrayProperty propertyName="PhoneNumbers" typeName="string" />
</ECEntityClass>
```

## Navigation Properties

Navigation properties are ECProperties that point to a related object. They are always backed by an ECRelationshipClass.

In the context of ECSQL navigation properties are interpreted as structs made up of the
following system properties:

Property | Description
--- | ---
`Id` | ECInstanceId of the related instance
`RelECClassId` | ECClassId of the ECRelationshipClass backing the navigation property. It is mainly relevant when the ECRelationshipClass has subclasses.

> Navigation properties are a convenient short-cut for [ECSQL Joins](#joins).

See also [ECRelationshipClasses](#ecrelationshipclasses).

### Examples

ECSQL | Description
--- | ---
`SELECT Parent FROM bis.Element WHERE ECInstanceId=?` | Returns the Parent navigation property as a whole (including Id and RelECClassId)
`SELECT Parent.Id FROM bis.Element WHERE ECInstanceId=?` | Returns just the Id member of the Parent navigation property
`SELECT Parent.Id, Parent.RelECClassId FROM bis.Element WHERE ECInstanceId=?` | Returns the Id, and the RelECClassId member of the Parent navigation property as two separate columns

## ECRelationshipClasses

As ECRelationshipClasses are ECClasses as well, they can be used in ECSQL like ECClasses. Their additional relationship semantics is expressed by these system properties.

Property | Description
--- | ---
`SourceECInstanceId` | ECInstanceId of the instance on the *source* end of the relationship
`SourceECClassId` | ECClassId of the instance on the *source* end of the relationship
`TargetECInstanceId` | ECInstanceId of the instance on the *target* end of the relationship
`TargetECClassId` | ECClassId of the instance on the *target* end of the relationship

> - If the ECRelationshipClass is backed by a [Navigation property](#navigation-properties), it is usually much easier to use the navigation property in your ECSQL than the ECRelationshipClass.
> - `SourceECClassId` and `TargetECClassId` are skipped when performing a `SELECT * FROM` statement or an `INSERT INTO` statement without a property name list.

### Examples

ECSQL | Description
--- | ---
`SELECT SourceECInstanceId FROM bis.ElementDrivesElement WHERE TargetECInstanceId=? AND Status=?` | Returns the ECInstanceId of all Elements that drive the Element bound to the first parameter
`SELECT TargetECInstanceId,TargetECClassId FROM bis.ModelHasElements WHERE SourceECInstanceId=?` | Returns the ECInstanceId and ECClassId of all Elements contained by the Model bound to the parameter

## Joins

Joins between ECClasses are specified with the standard SQL join syntax (either `JOIN` ... `ON` ... or the *theta* style).

In ECSchemas ECRelationshipClasses are used to relate two ECClasses. ECRelationshipClasses can therefore be seen as virtual link tables between those two classes. If you want to join two ECClasses via their ECRelationshipClass, you need to join the first class to the relationship class and then the relationship class to the second class.

If [navigation properties](#navigation-properties) are defined for the ECRelationship class, use the navigation property instead of a join.

### Examples

Without navigation property (2 JOINs needed):

```sql
SELECT e.CodeValue,e.UserLabel FROM bis.Element driver JOIN bis.ElementDrivesElement ede ON driver.ECInstanceId=ede.SourceECInstanceId JOIN bis.Element driven ON driven.ECInstanceId=ede.TargetECInstanceId WHERE driven.ECInstanceId=? AND ede.Status=?
```

With navigation property (Element.Model):

Return the CodeValue and UserLabel of all Elements in the Model with the specified condition (1 JOIN needed):

```sql
SELECT e.CodeValue,e.UserLabel FROM bis.Element e JOIN bis.Model m ON e.Model.Id=m.ECInstanceId WHERE m.Name=?
```

Return the Model for an Element with the specified condition (No join needed):

```sql
SELECT Model FROM bis.Element WHERE ECInstanceId=?
```

## Polymorphic Queries

By default, any ECClass in the FROM clause of an ECSQL is treated polymorphically, i.e. all its subclasses are considered as well. If an ECClass should be treated non-polymorphically, i.e. only the class itself and not its subclasses should be considered, add the `ONLY` keyword in front of it.

> This also applies to [Mixins](../bis/intro/mixins.md). Mixins technically are ECClasses (abstract Entity ECClasses to be precise). So you can simply query against a mixin class without knowing which classes actually implement the mixin.

### Examples

ECSQL | Description
--- | ---
`SELECT ECInstanceId FROM bis.Element WHERE Model=?``  | Returns all Elements of any subclass in the specified Model
`SELECT ECInstanceId FROM bis.SpatialViewDefinition WHERE ModelSelector=?``  | Returns SpatialViewDefinitions rows and rows of its subclasses for the specified ModelSelector
`SELECT ECInstanceId FROM ONLY bis.SpatialViewDefinition WHERE ModelSelector=?``  | Returns only SpatialViewDefinitions rows for the specified ModelSelect, but no rows from its subclasses.

## LIMIT and OFFSET

One way to implement paging is to use the `LIMIT` and `OFFSET` clauses in ECSQL.
The `LIMIT` clause is used to limit the number of results returned from an ECSQL statement. Using `LIMIT`
together with `OFFSET` allows specifying a range of rows to be returned. The `OFFSET` hereby specifies how many rows will be omitted from the result set. The `LIMIT` specifies the number of rows to be
returned.

### Examples

Return only the first 50 matching Elements:

```sql
SELECT ECInstanceId,CodeValue,Parent FROM BisCore.Element WHERE Model=? LIMIT 50
```

Return the 201st through 250th matching Element:

```sql
SELECT ECInstanceId,CodeValue,Parent FROM BisCore.Element WHERE Model=? LIMIT 50 OFFSET 200
```

## SQL Functions

SQL functions, either built into SQLite or custom SQL functions, can be used in ECSQL.

### Examples

```sql
SELECT substr(CodeValue,1,5) FROM bis.Element WHERE Model=?`
```

```sql
SELECT ECInstanceId FROM bis.Element WHERE lower(UserLabel)=?`
```

See also [SQLite Functions overview](https://www.sqlite.org/lang_corefunc.html).

## Spatial Queries and Geometry Functions

ECSQL can perform [spatial queries](./SpatialQueries.md).

ECSQL has a number of [built-in geometry functions](./GeometrySqlFuncs.md)

## Common Table Expressions

ECSQL can do regular and recursive [CTE queries](./CommonTableExp.md)
