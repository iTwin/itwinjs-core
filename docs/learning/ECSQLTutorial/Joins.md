---
ignore: true
---
# Joins and ECRelationshipClasses

## ECRelationshipClasses

As ECRelationshipClasses are ECClasses as well, they can be used in ECSQL like ECClasses. Their additional relationship semantics is expressed by these system properties.

Property | Description
--- | ---
`SourceECInstanceId` | ECInstanceId of the instance on the *source* end of the relationship
`SourceECClassId` | ECClassId of the instance on the *source* end of the relationship
`TargetECInstanceId` | ECInstanceId of the instance on the *target* end of the relationship
`TargetECClassId` | ECClassId of the instance on the *target* end of the relationship

> If the ECRelationshipClass is backed by a [Navigation property](#navigation-properties), it is usually much easier to use the navigation property in your ECSQL than the ECRelationshipClass.

### Examples

ECSQL | Description
--- | ---
`SELECT SourceECInstanceId FROM bis.ElementDrivesElement WHERE TargetECInstanceId=? AND Status=?` | Returns the ECInstanceId of all Elements that drive the Element bound to the first parameter
`SELECT TargetECInstanceId,TargetECClassId FROM bis.ModelHasElements WHERE SourceECInstanceId=?` | Returns the ECInstanceId and ECClassId of all Elements contained by the Model bound to the parameter

## Joins

Joins between ECClasses are specified with the standard SQL join syntax (either `JOIN` ... `ON` ... or the *theta* style).

In ECSchemas ECRelationshipClasses are used to relate two ECClasses. ECRelationshipClasses can therefore be seen as virtual link tables between those two classes. If you want to join two ECClasses via their ECRelationshipClass, you need to join the first class to the relationship class and then the relationship class to the second class.

> If [navigation properties](#navigation-properties) are defined for the ECRelationship class,
> - you don't need to JOIN at all, when going from the 'Many' to the 'One' end,
> - you can omit the JOIN to the ECRelationshipClass, when going from the 'One' to the 'Many' end

#### Examples

Without navigation property (2 JOINs needed):

`SELECT e.CodeValue,e.UserLabel FROM bis.Element driver JOIN bis.ElementDrivesElement ede ON driver.ECInstanceId=ede.SourceECInstanceId JOIN bis.Element driven ON driven.ECInstanceId=ede.TargetECInstanceId WHERE driven.ECInstanceId=? AND ede.Status=?`

With navigation property (Element.Model):

Return the CodeValue and UserLabel of all Elements in the Model with the specified condition (1 JOIN needed):

`SELECT e.CodeValue,e.UserLabel FROM bis.Element e JOIN bis.Model m ON e.Model.Id=m.ECInstanceId WHERE m.Name=?`

Return the Model for an Element with the specified condition (No join needed):

`SELECT Model FROM bis.Element WHERE ECInstanceId=?`