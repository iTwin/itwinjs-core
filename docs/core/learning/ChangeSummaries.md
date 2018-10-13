# Change Summaries

*Change Summaries* are summaries of changes of ECInstances in an *iModel Changeset*.

## Generating Change Summaries

Change Summaries are generated per changeset. Every generated Change Summary is therefore uniquely associated
to the Changeset it was generated from.

iModel.js persists the generated Change Summaries in a local ECDb file called **Change Cache file** next to the briefcase it belongs to.

> Change Summaries can only be generated from the iModel.js backend. See the [ChangeSummaryManager]($backend) API for how to do it.

## Working with Change Summaries

Working with Change Summaries really means to unleash the power of ECSQL. Change Summaries by itself are just ECInstances of the built-in ECSchemas **ECDbChange** and **IModelChange**. That means you can simply use [ECSQL](./ECSQL.md) and all its flexibility to retrieve just that information from the Change Summaries which you are interested in.

### Attaching the Change Cache file to the local briefcase

As the Change Summaries are not persisted in the iModel itself but in the *Change Cache file*, you need to attach the *Change Cache file* to the local briefcase of the iModel first.

Once done, the Change Summaries can be accessed by ECSQL from the iModel as if they were persisted in the iModel itself. The *Change Cache file* is visible from ECSQL under the table space **ecchange**.

> The table space of the attached *Change Cache file* is needed to disambiguate between equally named schemas and classes in the iModel and
> the Change Cache file. If the schema and class name combination is unambiguous, the table space does not need to be specified in the ECSQL.

### Leveraging Change Summary information

There are two main ways to use Change Summary information:

1. Find out **what** classes, **what** instances, **what** property values have changed
1. Find out **how** property values of certain instances have changed

### Find out *what* has changed

This is achieved by executing ECSQL queries against the [ECDbChange](./ECDbChange.ecschema.md) and [IModelChange](./ImodelChange.ecschema.md) ECSchemas:

- The [ECDbChange](./ECDbChange.ecschema.md) ECSchema contains the Change Summaries
- The [IModelChange](./ImodelChange.ecschema.md) ECSchema contains information about the Changesets from which each ChangeSummary was generated from

#### Examples

ECSQL | Description
--- | ---
`SELECT Summary.Id,ParentWsgId,Description,PushDate,Author FROM ecchange.imodelchange.ChangeSet WHERE WsgId=?` | For the specified Changeset (the WsgId of the Changeset) the ECInstanceId of the corresponding ChangeSummary is returned along with the id of the parent changeset, the description, the date when the changeset was pushed and by who
`SELECT ChangedInstance.Id, OpCode FROM ecchange.change.InstanceChange WHERE Summary.Id=?` | Returns the Ids of all changed instances in the specified Change Summary, plus the instance change's [ChangeOpCode]($common) (e.g. whether the instance was inserted, updated or deleted)

### Find out *how* values have changed

Querying for the changed values is done with the ECSQL function **Changes**.

#### Syntax

```sql
SELECT ... FROM MySchema.MyClass.Changes(ChangeSummaryId, ChangedValueState) ...
```

- `ChangeSummaryId`: The ECInstanceId of the Change Summary.
- `ChangedValueState`: corresponds to the values of the enum [ChangedValueState]($common).

 > You can format the *ChangedValueState* in the ECSQL either by the enum's integral values or by the enum value's name.
 > The following two ECSQL statements are equivalent:

```sql
SELECT ... FROM MySchema.MyClass.Changes(12, 1)
```

```sql
SELECT ... FROM MySchema.MyClass.Changes(12, 'AfterInsert')
 ```

> Notes when specifying [ChangedValueState.BeforeUpdate]($common) or [ChangedValueState.AfterUpdate]($common):
>
> For any property in the ECSQL select clause, the value of which has not changed in the specified change summary,
> the **value of the current state of the file** is returned. The function does **NOT** return the value it had in the
> version the change summary referred to.
>
> If the row in the current state does not exist anymore (because it was deleted in subsequent changesets), *null* will be returned for the unchanged values.

## Example Scenario

The following ECSchema is used to illustrate the example.

```xml
<ECSchema schemaName="ACME" alias="acme" version="01.00.00">
  <ECEntityClass typeName="Person">
    <ECProperty propertyName="Name" typeName="string"/>
    <ECProperty propertyName="Age" typeName="int"/>
  </ECEntityClass>
</ECSchema>
```

### Changeset 1

##### Operations

- Insert a new Person (Id 1)

##### Result

Id  | Name | Age
--- | ---- | ---
1   | Mery | 20

### Changeset 2

##### Operations

- Update Name of Person (Id 1) from Mery to Mary
- Insert a new Person (Id 2)

##### Result

Id  | Name | Age
--- | ---- | ---
1   | Mary | 20
2   | Sam  | 30

### Changeset 3

##### Operations

- Delete Person (Id 1)

##### Result

Id  | Name | Age
--- | ---- | ---
2   | Sam  | 30

### ECSQL Examples

After having extracting Change Summaries for each of the three Changesets the following ECSQL examples would return the following results.

> **Example**
>
> ```sql
> SELECT Summary.Id,ChangedInstance.Id,OpCode FROM change.InstanceChange
> ```
>
> *Result*
>
> `Summary.Id` | `ChangedInstance.Id` | `OpCode`
> ------------ | -------------------- | -------
> 1            | 1                    | 1 (Insert)
> 2            | 1                    | 2 (Update)
> 2            | 2                    | 1 (Insert)
> 3            | 1                    | 4 (Delete)
>
> - `ChangedInstance.Id` is the ECInstanceId of the changed instance, i.e. the changed `Person` instance in this example.
> - The `OpCode` values refer to the [ChangeOpCode]($common) enumeration as defined in the [ECDbChange](./ECDbChange.ecschema.md) ECSchema.

---

> **Example**
>
> ```sql
> SELECT i.ChangedInstance.Id, p.AccessString, i.OpCode FROM change.PropertyValueChange p
>     JOIN change.InstanceChange i USING change.InstanceChangeOwnsPropertyValueChanges
>     WHERE i.Summary.Id=2
> ```
>
> *Result*
>
> `ChangedInstance.Id` | `AccessString` | `OpCode`
> -------------------- | -------------- | -------
> 1                    | Name           | 2 (Update)
> 2                    | Name           | 1 (Insert)
> 2                    | Age            | 1 (Insert)
>
> The ECSQL returns the property values that have changed in the Change Summary with Id 2. For every property value change, the
> ECInstanceId of the respective class is returned as well as the OpCode.
>
> - Row #1 means that the `Name` of `Person` 1 was **updated**.
> - Row #2 means that the `Name` of `Person` 2 was **inserted**.
> - Row #3 means that the `Age` of `Person` 2 was **inserted**.

The following illustrates examples to find out how values have changed. We start by looking at the Persons in the current state of the iModel, i.e. at the tip of all changes:

>
> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> 2              | Sam    | 30

#### ECSQL function `Changes`

The following examples illustrate how to go back in history using the ECSQL function **Changes**.

##### Changes in Change Summary 1

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(1,'AfterInsert')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> 1              | Mery   | 20

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(1,'BeforeUpdate')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(1,'AfterUpdate')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(1,'BeforeDelete')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

##### Changes in Change Summary 2

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(2,'AfterInsert')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> 2              | Sam    | 30

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(2,'BeforeUpdate')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> 1              | Mery   | null

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(2,'AfterUpdate')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> 1              | Mary   | null

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(2,'BeforeDelete')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

##### Changes in Change Summary 3

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(3,'AfterInsert')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(3,'BeforeUpdate')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(3,'AfterUpdate')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> no rows | |

---

> ```sql
> SELECT ECInstanceId, Name, Age FROM acme.Person.Changes(3,'BeforeDelete')
> ```
>
> *Result*
>
> `ECInstanceId` | `Name` | `Age`
> -------------- | ------ | ----
> 1              | Mery   | null
