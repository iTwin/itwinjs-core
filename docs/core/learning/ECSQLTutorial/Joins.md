# Relationships and Joins

## ECRelationshipClasses

As ECRelationshipClasses are ECClasses as well, they can be used in ECSQL like ECClasses. Their additional relationship semantics are expressed by these system properties.

Property | Description
--- | ---
`SourceECInstanceId` | ECInstanceId of the instance on the *source* end of the relationship
`SourceECClassId` | ECClassId of the instance on the *source* end of the relationship
`TargetECInstanceId` | ECInstanceId of the instance on the *target* end of the relationship
`TargetECClassId` | ECClassId of the instance on the *target* end of the relationship

> **Try it yourself**
>
> *Goal:* Return the child [Element](../../bis/domains/biscore/BisCore.ecschema.md#Element)s (id and class id) of the parent [Element](../../bis/domains/biscore/BisCore.ecschema.md#Element) 0x10000000013
>
> *ECSQL*
> ```sql
>  SELECT TargetECInstanceId ChildId, TargetECClassId ChildClassId FROM bis.ElementOwnsChildElements WHERE SourceECInstanceId=0x10000000013
> ```
> *Result*
>
> ChildId | ChildClassId
> --- | ---
> 0x10000000014 | 0xf4
> 0x10000000015 | 0xf4

Like any ECClass, ECRelationshipClasses abstract away how they are actually persisted in the database. When working with plain database and SQL you need to know that. This usually depends on the cardinality of the relationship. For example M:N relationships (also known as *many to many*) require a separate link table which persists the pairs of related instances. For 1:N relationhips (also known as *one to many*) though, the id of the related instance is usually persisted as foreign key in the child table directly. **For ECRelationshipClasses you do not need to know that.**

We will cover relationships more in the next chapter on joins.

## Joins

Joins are a powerful feature of ECSQL to combine data from different classes. **The syntax is the same as as in SQL**.

Unlike a plain database, ECSchemas provide first-class concepts like [ECRelationshipClasses](#ecrelationshipclasses) and [Navigation properties](.\ECSQLDataTypes.md#navigation-properties) which are helpful when using joins in ECSQL. However, you can also use the joins as you did in SQL without being aware of the above-mentioned concepts.

### Quick Recap

The tutorial expects that you are familiar with SQL joins. Because their understanding is crucial for how relationships and navigation properties affect defining joins, we do a quick recap of the key aspects of joins.

A join is made up of two pieces:

- *What to join*: specifies the class to join to.
- *How to join*: specifies the join condition. Those pairs of rows from the two classes that match the condition end up in the join.

While you can use any condition, the typical join condition matches a property common to both of the joined classes. This is where ECRelationshipClasses and Navigation properties come into play. The next sections explain why.

### Navigation Properties

[Navigation properties](./ECSQLDataTypes.md#navigation-properties)' main goal is to simplify the navigation from instances to related instances. Consequently, whenever you have a navigation property, you do not need to worry about a join anymore.

The rule of thumb therefore is: **Prefer navigation properties over joins when available.**

However, navigation properties cannot replace all use cases of joins. We will look at those in the next sections.
We will also cover examples that compare ECSQL using navigation properties with ECSQL using joins once we learnt how to use joins with ECRelationshipClasses.

### Joins using ECRelationshipClasses

Relationships are basically pairs of ids of the related instances. They act as middle-man when joining instances from the two related classes. It does not matter how the relationship is actually persisted (which also depends on the cardinality of the relationship) (see also [ECRelationshipClasses](#ecrelationshipclasses)).

General idea: **join from a class to the relationship class and then join from the relationship class to the related class**

### Ad-hoc Joins

As noted above, you can have a join using any arbitrary join condition (*ad-hoc joins*). Usually you will find relationship classes or even navigation properties defined for the typical cases you need to join. Ad-hoc joins are therefore mainly needed if that is **not** the case.

### Examples

As explained above using navigation properties instead of joins is preferred. So always double-check whether a navigation property is defined for the ECRelationshipClass you want to navigate. The examples below show how to use navigation properties and how the corresponding ECSQL using ECRelationshipClasses would look like.

> **Try it yourself**
>
> *Goal:* Return the [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model) that contains the [Device](./MyDomain.ecschema.md#Device) with code 'DEV-A-2-6'.
>
> *ECSQL*
> ```sql
>  SELECT Model FROM MyDomain.Device WHERE CodeValue='DEV-A-2-6'
> ```
>
> *Result*
>
> Model |
> --- |
> {"id": "0x10000000011", "relClassName":"BisCore.ModelContainsElements"} |

Note that the above ECSQL implies to navigate from the [Device](./MyDomain.ecschema.md#Device) ECClass (which is a subclass of [Element](../../bis/domains/biscore/BisCore.ecschema.md#Element) to the [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model) ECClass using the ECRelationshipClass [ModModelContainsElementsel](../../bis/domains/biscore/BisCore.ecschema.md#ModelContainsElements). But none of that has to be expressed in the ECSQL. It is all hidden behind the navigation property and makes the ECSQL straight-forward.

The following ECSQL is the same as above but uses joins instead of the navigation property.

> **Try it yourself**
>
> *Goal:* Return the [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model) that contains the [Device](./MyDomain.ecschema.md#Device) with code 'DEV-A-2-6'.
>
> *ECSQL*
> ```sql
> SELECT rel.SourceECInstanceId ModelId FROM bis.ModelContainsElements rel JOIN bis.Element ON rel.TargetECInstanceId=Element.ECInstanceId WHERE Element.CodeValue='DEV-A-2-6'
> ```
>
> *Result*
>
> ModelId |
> --- |
> 0x10000000011 |

If you want to return something else than just the id of the related instance, you can still use the navigation property but you need a join to bring in the related instance's class.

> **Try it yourself**
>
> *Goal:* Return the id, the modeled element and the parent model of the [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model) that contains the [Device](./MyDomain.ecschema.md#Device) with code 'DEV-A-2-6'.
>
> *ECSQL*
> ```sql
> SELECT Model.ECInstanceId,Model.ModeledElement.Id ModeledElementId,Model.ParentModel.Id ParentModelId FROM bis.Model JOIN bis.Element ON Element.Model.Id=Model.ECInstanceId WHERE Element.CodeValue='DEV-A-2-6'
> ```
> *Result*
>
> ECInstanceId | ModelElementId | ParentModelId
> --- | --- | ---
> 0x10000000011 | 0x10000000011 | 0x1

Again for the purpose of learning, the same ECSQL expressed with relationship classes instead of navigation properties looks like this.

> **Try it yourself**
>
> *Goal:* Return the id, the modeled element and the parent model of the [Model](../../bis/domains/biscore/BisCore.ecschema.md#Model) that contains the [Device](./MyDomain.ecschema.md#Device) with code 'DEV-A-2-6'.
>
> *ECSQL*
> ```sql
> SELECT Model.ECInstanceId,Model.ModeledElement.Id ModeledElementId,Model.ParentModel.Id ParentModelId FROM MyDomain.Device JOIN bis.ModelContainsElements rel ON Device.ECInstanceId=rel.TargetECInstanceId JOIN bis.Model ON rel.SourceECInstanceId=Model.ECInstanceId WHERE Device.CodeValue='DEV-A-2-6'
> ```
>
> *Result*
>
> ECInstanceId | ModelElementId | ParentModelId
> --- | --- | ---
> 0x10000000011 | 0x10000000011 | 0x1

---

[**< Previous**](./ECSQLDataTypes.md) &nbsp; | &nbsp; [**Next >**](./PolymorphicQueries.md)