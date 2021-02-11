# Querying Change Summaries

*Change Summaries* are summaries of changes of ECInstances in an *iModel Changeset*. **Please read [Change Summaries](../ChangeSummaries.md) first, before doing this section of the tutorial.**

[!alert text="<img src="./media/wip.svg" style="width:2%;height:2%;"> The console does not support write operations, this functionality has been deprecated. This page is kept for historical and educational purposes" kind="warning"]

## Generate the Change Summaries

In case the Change Summaries have not be generated yet for the tutorial's iModel, you have to do that first.

In the iModelConsole run the following commands:

Close the iModel first and re-open it read-write, so that you can generate the Change Summaries:

```
.close
.open -project:ECSQL -mode:readwrite
.change extractsummaries
```

Now close the iModel again and re-open it read-only.

```
.close
.open -project:ECSQL
```

## Attach the Change Summaries

As explained in [Change Summaries](../ChangeSummaries.md), you need to attach the file that contains
the generated Change Summaries to this iModel by running this command in the iModelConsole:

```
.change attachcache
```

## Sample Change History

To keep this section as simple as possible, the iModel has three changesets, each with simple changes. They are described
here in text to help understand the following queries.

### Changeset 1

Operations:

- Insert a new [Device](./MyDomain.ecschema.md#device) with code `DEV-A-G-3` and User Label 'Fire detector'

Result:

ECInstanceId | CodeValue | UserLabel
--- | --- | ---
0x20000000001 | DEV-A-G-3 | Fire detector

### Changeset 2

Operations:

- Update the User Label of [Device](./MyDomain.ecschema.md#device) `DEV-A-G-3` to 'Fire extinguisher'
- Insert a new [Device](./MyDomain.ecschema.md#device) with code `DEV-A-G-4` and User Label 'Fire detector'

Result:

ECInstanceId | CodeValue | UserLabel
--- | --- | ---
0x20000000001 | DEV-A-G-3 | Fire extinguisher
0x20000000002 | DEV-A-G-4 | Fire detector

### Changeset 3

Operations:

- Delete [Device](./MyDomain.ecschema.md#device) `DEV-A-G-3` again

Result:

ECInstanceId | CodeValue | UserLabel
--- | --- | ---
0x20000000002 | DEV-A-G-4 | Fire detector

## Mining the Change Summaries

There are two main ways to mine Change Summary information:

1. Find out **what** classes, **what** instances, **what** property values have changed
1. Find out **how** property values of certain instances have changed

The following examples will run through both of them.

## Explore *what* has changed

Generally there are three main classes in the [ECDbChange ECSchema](../ECDbChange.ecschema.md) to explore what has changed:

- [ChangeSummary](../ECDbChange.ecschema.md#changesummary)
- [InstanceChange](../ECDbChange.ecschema.md#instancechange)
- [PropertyValueChange](../ECDbChange.ecschema.md#propertyvaluechange)

Additionally the [IModelChange ECSchema](../IModelChange.ecschema.md) contains the [ChangeSet](../IModelChange.ecschema.md#changeset) ECClass that links a Change Summary to the changeset from which it was generated.

The following examples will run through all of them.

### What Change Summaries are there

Let's first find some information about the changesets for which Change Summaries have been generated. The query
also serves to return the ECInstanceIds of the corresponding Change Summaries which we will need for all other queries.

> **Try it yourself**
>
> *Goal:* Return the ECInstanceId of the Change Summaries and information about the corresponding changesets,
> ordered from oldest to newest.
>
> *ECSQL*
>
> ```sql
> SELECT Summary.Id, WsgId, Description, PushDate, UserCreated, ParentWsgId FROM imodelchange.Changeset ORDER BY PushDate
> ```
>
> *Result*
>
> Summary.Id | WsgId | Description | PushDate | UserCreated | ParentWsgId
> --- | --- | --- | --- | --- | ---
> 0x6c | f7c220138713044a89f4e5fa479564863516b53b | Inserted new Device 'DEV-A-G-3'. | 2018-12-18T16:03:08.373Z | some user id | NULL
> 0x35 | 9c4239a1fef7cc7136fcef1f6a7472a3b0ffbd7d | Fixed user label of Device 'DEV-A-G-3'. Inserted new Device 'DEV-A-G-4'.| 2018-12-18T16:03:19.763Z | some user id  | f7c220138713044a89f4e5fa479564863516b53b
> 0x1 | 1264417d6364c79d3d1c8d6a45ee6e3ee79188c4 | Removed Device 'DEV-A-G-3' again. | 2018-12-18T16:03:27.140Z | some user id  | 9c4239a1fef7cc7136fcef1f6a7472a3b0ffbd7d

### What instances have changed in a Change Summary

Now that we know what changesets there are, let us look what instances were changed in one of them.

> **Try it yourself**
>
> *Goal:* Return the id and class id of all instances that have changed in Change Summary `0x35`, including the op code
> for each change.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId, ChangedInstance.Id, ChangedInstance.ClassId, OpCode FROM ecchange.change.InstanceChange WHERE Summary.Id=0x35
> ```
>
> *Result*
>
> ECInstanceId | ChangedInstance.Id | ChangedInstance.ClassId | OpCode
> --- | --- | --- | ---
> 0x36 | 0x20000000002 | 0x100 | Insert
> 0x48 | 0x20000000001 | 0x100 | Update
> 0x52 | 0x20000000002 | 0x9b | Insert
> 0x57 | 0x20000000002 | 0xbd | Insert
> 0x5c | 0x20000000002 | 0x4f | Insert
> 0x61 | 0x20000000002 | 0x56 | Insert
> 0x66 | 0x20000000002 | 0x58 | Insert

For the sake of readability we modify the query by joining to the [ECDbMeta ECSchema](./MetaQueries.md) so that the class names of the changed instances are output.

> **Try it yourself**
>
> *Goal:* Return the id and class name of all instances that have changed in Change Summary `0x35`, including the op code
> for each change.
>
> *ECSQL*
>
> ```sql
> SELECT ic.ECInstanceId, ic.ChangedInstance.Id,  s.Name || '.' || c.Name ChangedClass, ic.OpCode FROM ecchange.change.InstanceChange ic
> JOIN main.meta.ECClassDef c ON ic.ChangedInstance.ClassId=c.ECInstanceId
> JOIN main.meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE ic.Summary.Id=0x35
> ```
>
> *Result*
>
> ECInstanceId | ChangedInstance.Id | ChangedClass | OpCode
> --- | --- | --- | ---
> 0x36 | 0x20000000002 | MyDomain.Device | Insert
> 0x48 | 0x20000000001 | MyDomain.Device | Update
> 0x52 | 0x20000000002 | BisCore.GeometricElement3dIsInCategory | Insert
> 0x57 | 0x20000000002 | BisCore.PhysicalElementIsOfType | Insert
> 0x5c | 0x20000000002 | BisCore.ModelContainsElements | Insert
> 0x61 | 0x20000000002 | BisCore.CodeSpecSpecifiesCode | Insert
> 0x66 | 0x20000000002 | BisCore.ElementScopesCode | Insert

#### How to read the result of this query

Here is the gist of what you can read from this query:

- 7 instances were changed in Change Summary 0x35.
- 1 instance (a Device) was modified in that changeset.
- 6 instances were added to the iModel in that changeset.
- The [change history's description](#sample-change-history) states that one device was modified and one was added in this changeset. Why are there 5 more changes in this changeset? Inserting a device implicitly sets all its relationships, too. This is what the other 5 changes represent.

### What properties have changed for a changed instance

Now that we know that [Device](./MyDomain.ecschema.md#device) `0x36` was modified in Change Summary `0x35` we might want to find
out what properties were modified.

> **Try it yourself**
>
> *Goal:* Return the names of the properties that were modified in the InstanceChange `0x48`.
>
> *ECSQL*
>
> ```sql
> SELECT AccessString FROM change.PropertyValueChange WHERE InstanceChange.Id=0x48
> ```
>
> *Result*
>
> AccessString |
> --- |
> LastMod |
> UserLabel |

As we know from the [change history's description](#sample-change-history), the modification of `UserLabel` is expected. Why was `LastMod` modified as well? This again is an implicit change, caused by a trigger on the [Element.LastMod](../../bis/domains/BisCore.ecschema.md#element) property which sets it to the current time whenever
the element is modified.

Here we used the ECInstanceId `0x48` of the respective InstanceChange object that represents the update of Device `0x20000000001`
from the previous query. As always we can use a join, if we only know the id of the changed device, but not the id of the actual change object:

> **Try it yourself**
>
> *Goal:* Return the names of the properties that were modified in Device `0x20000000001` in Change Summary `0x35`.
>
> *ECSQL*
>
> ```sql
> SELECT AccessString FROM change.PropertyValueChange pc JOIN change.InstanceChange ic ON pc.InstanceChange.Id=ic.ECInstanceId WHERE ic.ChangedInstance.Id=0x20000000001 AND ic.ChangedInstance.ClassId=0x100 AND ic.Summary.Id=0x35
> ```
>
> *Result*
>
> AccessString |
> --- |
> LastMod |
> UserLabel |

To deepen the understanding of Change Summaries, let's look why we have to add the `AND ic.Summary.Id=0x35` expression to the WHERE clause in the above query. If we forgot to add it, the query would return many more rows than just the expected two. The reason for that is simply that an instance can be changed in different change summaries. In fact, if you look at the [change history's description](#sample-change-history) again, we notice that Device `0x20000000001` is modified in all three changesets. First, it is inserted, then it is modified, and finally it is deleted. The query then returns all properties that have changed in all changesets.

Now that we looked at this, let's modify the previous query and use the Change Summary of the last changeset:

> **Try it yourself**
>
> *Goal:* Return the names of the properties of Device `0x20000000001` that were affected in Change Summary `0x1`.
>
> *ECSQL*
>
> ```sql
> SELECT AccessString FROM change.PropertyValueChange pc JOIN change.InstanceChange ic ON pc.InstanceChange.Id=ic.ECInstanceId WHERE ic.ChangedInstance.Id=0x20000000001 AND ic.ChangedInstance.ClassId=0x100 AND ic.Summary.Id=0x1
> ```
>
> *Result*
>
> AccessString |
> --- |
> BBoxHigh.X |
> BBoxHigh.Y |
> BBoxHigh.Z |
> BBoxLow.X |
> BBoxLow.Y |
> BBoxLow.Z |
> Category.Id |
> CodeScope.Id |
> CodeSpec.Id |
> CodeValue |
> FederationGuid |
> GeometryStream |
> InSpatialIndex |
> LastMod |
> Model.Id |
> Origin.X |
> Origin.Y |
> Origin.Z |
> Pitch |
> Roll |
> TypeDefinition.Id |
> TypeDefinition.RelECClassId |
> UserLabel |
> Yaw |

The query indicates that all properties of the Device were modified in that changeset. Why? Let's quickly run a query
that tells us what kind of change this was, i.e. what the OpCode of that change was:

> **Try it yourself**
>
> *Goal:* Return the OpCode for the change of Device `0x20000000001` in Change Summary `0x1`.
>
> *ECSQL*
>
> ```sql
> SELECT OpCode FROM change.InstanceChange WHERE Summary.Id=0x1 AND ChangedInstance.Id=0x20000000001 AND ChangedInstance.ClassId=0x100
> ```
>
> *Result*
>
> OpCode |
> --- |
> Delete |

Now we can explain why the query before returned all properties: As Device `0x20000000001` was deleted in that changeset, all its property values were deleted as well. Consequently, the [PropertyValueChange](../ECDbChange.ecschema.md#propertyvaluechange) ECClass records all properties of the class as being deleted.
The same is true for `Inserts`. You can try that out yourself if you replace the Change Summary id in the previous queries with `0x6c`.

## Explore *how* data has changed

In order to see how the property values of instances have changed in a given changeset, the ECSQL function `Changes` can be used.

### Changes Function Syntax

```sql
SELECT ... FROM MySchema.MyClass.Changes(ChangeSummaryId, ChangedValueState) ...
```

- `ChangeSummaryId`: The ECInstanceId of the Change Summary.
- `ChangedValueState`: corresponds to the values of the enum [ChangedValueState]($common).

### Walking through the history

Before looking at how the Devices have changed over the time, let's look at the current state.

> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of all Devices.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> 0x10000000020 | DEV-A-G-1 | NULL
> 0x10000000022 | DEV-A-G-2 | NULL
> 0x10000000025 | DEV-A-1-1 | NULL
> 0x10000000028 | DEV-A-2-1 | NULL
> 0x1000000002a | DEV-A-2-2 | NULL
> 0x1000000002c | DEV-A-2-3 | NULL
> 0x1000000002e | DEV-A-2-4 | NULL
> 0x10000000030 | DEV-A-2-5 | NULL
> 0x10000000032 | DEV-A-2-6 | NULL
> 0x10000000034 | DEV-A-2-7 | NULL
> 0x10000000036 | DEV-A-2-8 | NULL
> 0x20000000002 | DEV-A-G-4 | Fire detector

#### Changes in the first changeset

> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of the Devices that were **inserted** in Change Summary `0x6c`.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device.Changes(0x6c,'AfterInsert')
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> 0x20000000001 | DEV-A-G-3 | Fire detector

This example returns the Devices inserted in the first changeset. The returned Device does no longer exist (as it was deleted in the latest changeset), but you can find it with the help of Change Summaries.

Now let's change the [ChangedValueState]($common) argument in the query.

> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of the Devices that were **updated** in Change Summary `0x6c`.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device.Changes(0x6c,'AfterUpdate')
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> no rows |

The query not returning anything just means that no Devices were updated in that changeset - which we already know from
the [change history's description](#sample-change-history) and the previous queries.

Consequently, the same result is obtained when using [ChangedValueState.BeforeUpdate]($common) and [ChangedValueState.BeforeDelete]($common).

#### Changes in the second changeset

From the previous queries we know that in this changeset a new Device with code `DEV-A-G-4` was inserted and an existing one's user label was modified.

> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of the Devices that were **inserted** in Change Summary `0x35`.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device.Changes(0x35,'AfterInsert')
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> 0x20000000002 | DEV-A-G-4 | Fire detector

When examining updated instances, we can look at the values **before and after** the update.
Note: `NULL` is returned for `CodeValue` because it was not affected by this changeset.

> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of the Devices **before** they were **updated** in Change Summary `0x35`.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device.Changes(0x35,'BeforeUpdate')
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> 0x20000000001 | NULL | Fire detector
---
> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of the Devices **after** they were **updated** in Change Summary `0x35`.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device.Changes(0x35,'AfterUpdate')
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> 0x20000000001 | NULL | Fire extinguisher

#### Changes in the third changeset

In the third changeset the Device with code `DEV-A-G-3` which was inserted in the first changeset was deleted again.

> **Try it yourself**
>
> *Goal:* Return id, CodeValue and UserLabel of the Devices **before** they were **deleted** in Change Summary `0x1`.
>
> *ECSQL*
>
> ```sql
> SELECT ECInstanceId,CodeValue,UserLabel FROM mydomain.Device.Changes(0x1,'BeforeDelete')
> ```
>
> *Result*
>
> ECInstanceId | CodeValue | UserLabel
> --- | --- | ---
> 0x20000000001 | DEV-A-G-3 | Fire extinguisher

---

[**< Previous**](./MetaQueries.md) &nbsp; | &nbsp; [**Next >**](./TypeFilter.md)
