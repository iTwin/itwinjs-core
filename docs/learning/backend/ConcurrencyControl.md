# Concurrency Control

Concurrency control is a way to coordinate simultaneous transactions (briefcases) while preserving data integrity. Concurrency control is implemented in the code of an app and is based on the identity of a briefcase. Concurrency control should not to be confused with user access control. To make coordinated changes, and app must follow 3 basic rules:

1. Reserve Codes before using them.
1. Optionally lock models and elements before modifying them.
1. Pull (and merge) before pushing.

An iModel has a concurrency control policy that specifies how multiple briefcases may modify models and elements. The policy may stipulate that locks must be used, forcing transactions to be sequential (pessimistic), or it may specify change-merging with conflict-resolution to combine the results of simultaneous transactions (optimistic).

An app uses [IModelDb]($imodeljs-backend.IModelDb) and [ConcurrencyControl]($imodeljs-backend.ConcurrencyControl) to follow concurrency control rules.

Locks and code reservations are associated with a briefcase while it is making changes and are released when it pushes.

## Background

This article assumes that you already know that:

* An iModel is a multi-user database
* An app works with a [briefcase](../learning/Glossary.md#Briefcase) using the [IModelDb]($imodeljs-backend.IModelDb) class.
* A briefcase has a unique identity that is issued and tracked by [iModelHub](../../overview/IModelHub.md).
* Changes are captured and distributed in the form of [ChangeSets](../learning/Glossary.md#ChangeSets).
* ChangeSets are ordered in a sequence that is called the [timeline](../../overview/IModelHub.md#the-timeline-of-changes) of the iModel.
* ChangeSets are stored in iModelHub
* A [Code](../learning/Glossary.md#Code) is an identifier that assigned to an element and is managed by a central Code Service.

## Concurrency Glossary

|Term | Definition
|------------|------------|
|**Base**|ChangeSet B is *based* on ChangeSet A if B comes after A in the [timeline](../../overview/IModelHub.md#the-timeline-of-changes).
|**Change-merging**|Same as merge.
|**Code Reservation**|The right to use a Code
|**Concurrency Control**|How to coordinate simultaneous transactions while preserving data integrity.
|**Concurrency Control Policy**|The rules that apps must follow when changing models and elements. May be [optimistic](#optimistic-concurrency-control) or [pessimistic](#pessimistic-concurrency-control).
|**Conflict**|Arises when two ChangeSets change the same object in different ways, where neither ChangeSet is based on the other.
|**Conflict-resolution**|Choosing how to resolve a conflict.
|**Lock**|The right to access a specific type of data with specific sharing permissions.
|**Merge**|Apply a ChangeSet to a briefcase.
|**Optimistic Concurrency Control**|A policy that allows apps to change models and elements without acquiring locks.
|**Pessimistic Concurrency Control**|A policy that requires apps to acquire locks before changing models or elements.
|**Push**|Upload a ChangeSet to iModelHub
|**Pull**|Download a ChangeSet from iModelHub
|**Rebase**|Adjust a ChangeSet so that its pre-change state matches the post-change state of some other ChangeSet.
|**Revision**|The state of an iModel as of a specific point in its [timeline](../../overview/IModelHub.md#the-timeline-of-changes), that is, the result of the ChangeSets up to that point.
|**Tip**|The most recent revision of an iModel. Also, the most recent ChangeSet in the [timeline](../../overview/IModelHub.md#the-timeline-of-changes).
|**Transaction**|A set of changes that are committed or abandoned atomically, making up a unit of work. Multiple transactions to a briefcase are combined into a [ChangeSet](../learning/Glossary.md#ChangeSets).

## Code Reservation

An app must reserve all Codes that it plans to assign to elements during a local editing session. An app can reserve more Codes than it actually uses. For example, an app may reserve a range or block of Codes in a sequence to ensure that it can use them, but before it knows exactly how many it will need. When the local ChangeSet is finally pushed, the Code Service sorts out which reserved Codes were actually used and which were not. Unused Codes are returned to the pool, while used Codes are marked as used and unavailable. When an element is deleted, its Code may be returned to the pool(??).

The optimistic concurrency control policy does not apply to Codes.

## Data Write Concurrency Control Policies

 Preemptive locking is always required when importing Schemas or changing or inserting CodeSpecs. The APIs for those objects take care of locking automatically, so there is nothing special for an app to do.

 For models and elements, there are two locking policy options: pessimistic and optimistic. The [ConcurrencyControl]($imodeljs-backend.ConcurrencyControl) class specifies the concurrency control policy for an iModel. The app must check the ```iModelDb.concurrencyControl``` property to learn the policy and then implement it.

### Pessimistic Concurrency Control

 To set up an iModel to use the pessimistic concurrency control policy, specify the ConcurrencyControl.PessimisticPolicy, as follows:

 ``` typescript-no-lines
     iModel.concurrencyControl.setPolicy(new ConcurrencyControl.PessimisticPolicy());
 ```

The pessimistic concurrency policy requires that models and elements must be locked before local changes can be pushed to iModelHub. Locking prevents concurrent changes and forces briefcase transactions affecting the same models and elements to be sequential.

For reference, the pessimistic locking rules are as follows:
|Operation|LockType|Lock Level|
|------------|------------|--------|
|Insert element|Model|Shared
|Modify element|Element|Exclusive|
|Delete element|Element|Exclusive|
|Insert model|DgnDb|Shared|
|Modify model|Model|Exclusive|
|Delete model|Model|Exclusive|
|     "      |Elements in model|Exclusive|

An app will normally implement the pessimistic policy by using high-level APIs to build lock requests based on the intended operation, as explained [below](#acquiring-locks-and-reserving-codes). These high-level APIs take care of both acquiring locks and reserving Codes.

> A briefcase must pull before it can lock and element or model if it is affected by a recently pushed ChangeSet.

An app that implements the pessimistic concurrency control policy follows the pull -> lock -> change -> push pattern.

 ![pessimistic concurrency example workflow](./PessimisticConcurrencyControl.jpg)

Locks are normally released when the briefcase pushes its changes, or they may be released if the briefcase abandons its changes.

### Optimistic Concurrency Control

 To set up an iModel to use optimistic concurrency control, specify the ConcurrencyControl.OptimisticPolicy, as follows:

``` typescript-no-lines
     iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
```

 An optimistic concurrency policy allows apps to modify elements and models in an iModel without acquiring locks. In this case, the app uses change-merging to reconcile local changes before pushing.

 Working without locks opens up the possibility that other apps may add ChangeSets to the timeline while the local editing session is in progress. The briefcase must then merge before it can push.

 Suppose, for example, that two briefcases were editing different properties of the same element at the same time. Suppose that the first briefcase pushed first, creating ChangeSet#1. Now, the second briefcase must pull and merge before it can push.

 ![optimistic concurrency example workflow](./OptimisticConcurrencyControl.jpg)

 Working without locks also opens up the possibility that local changes may overlap with in-coming ChangeSets. When ChangeSets are merged into the briefcase, the change-merging algorithm checks for conflicts. The algorithm merges changes and checks for conflicts at the level of individual element properties. In the example above, the two briefcases changed different properties of the same element. That is not a conflict. Likewise, it is not a conflict for two briefcases both to set a property to the same value, or for two briefcases both to delete an element. Conflicts arise if the two briefcases set the same property to different values, or if one briefcase modifies a property and the other deletes the element.

 If conflicts are found, the change-merging algorithm applies the conflict-resolution policy that is part of the iModel's optimistic concurrency policy. Actually, the iModel has a separate resolution policy for each combination of changes that could conflict. The [ConcurrencyControl.ConflictResolutionPolicy]($imodeljs-backend.ConcurrencyControl.ConflictResolutionPolicy) class defines the conflict-resolution policies for an iModel.

 In general, there are three options when an in-coming change conflicts with a local change, which are members of ConcurrencyControl.OnConflict:

* AcceptIncomingChange - Accept the in-coming change, replacing the local change
* RejectIncomingChange - Reject the in-coming change, retaining the local change instead
* RejectChangeSet - Reject the entire in-coming ChangeSet

 In some cases, the accept or reject option is not available. In the case where rejection is not an option, then the policy may be to reject the in-coming ChangeSet as a whole. That allows the app to re-work the local change and try again. The briefcase must still pull and merge before it can push.

 The defaults conflict-resolution policies are:
 |Local Change|RemoteChange|Resolution|
 |------------|------------|--------|
 |update|update|ConcurrencyControl.OnConflict.RejectIncomingChange
 |update|delete|ConcurrencyControl.OnConflict.AcceptIncomingChange (reject not support)
 |delete|update|ConcurrencyControl.OnConflict.RejectIncomingChange (accept not supported)

 Property-level change-merging is very fine-grained, and so it allows many kinds of changes to be made simultaneously without conflicts. A schema may also specify rules to check for conflicts on a higher level.

 Only models and elements may be changed optimistically. Locking is required when importing Schemas or changing or inserting CodeSpecs.

 [1]: "Reject is not allowed."

## Acquiring Locks and Reserving Codes

A briefcase must reserve codes before pushing a ChangeSet to iModelHub. Under a pessimistic policy, the briefcase must also acquire all needed locks before pushing. The app has two options for when and how to acquire locks and/or codes during a local transaction: before making changes (preemptively) or after making changes (bulk mode).

### Acquiring locks and/or codes preemptively

 1. Call [Model.buildConcurrencyControlRequest]($imodeljs-backend.Model.buildConcurrencyControlRequest) and [Element.buildConcurrencyControlRequest]($imodeljs-backend.Element.buildConcurrencyControlRequest) to discover what locks and codes would be needed before making local changes.

 1. Call [ConcurrencyControl.request]($imodeljs-backend.ConcurrencyControl.request) to request the locks and/or codes that the planned local operations will require. This may send a request to iModelHub.
    * ==> If the request fails, roll back the local transaction and cancel the local operation.
 1. If the request succeeds, go ahead and make the planned local changes and then call [IModelDb.saveChanges]($imodeljs-backend.IModelDb.saveChanges).

 This approach is the safest way to avoid conflicts. It requires that the app must plan ahead before making local changes.

 > Sending a request to iModelHub is a relative expensive operation. Therefore to batch up requests for locks and/or Codes.

### Acquiring locks and/or codes in bulk mode

 1. Insert or update models and elements.

 1. Call [ConcurrencyControl.request]($imodeljs-backend.ConcurrencyControl.request) to request the locks and codes that those local operations require.
    * ==> If the request fails, call [IModelDb.cancelChanges]($imodeljs-backend.IModelDb.cancelChanges) to roll back the local transaction.
 1. If the request succeeds, call [IModelDb.saveChanges]($imodeljs-backend.IModelDb.saveChanges) to commit the local transaction.

 Using bulk mode is simpler than using the preemptive approach, but it carries the risk that you must abandon all of your changes in case of a locking or code-reservation conflict. Use this approach only if you know that your changes are isolated such that conflicts are unlikely.

## ChangeSets and Schema Changes

The special schema lock must be acquired before importing a schema into a briefcase. Also, schema changes must be isolated in a dedicated ChangeSet, separate from other kinds of changes. In practice, that means that an app that wants to import a schema must:

1. Push any local changes to iModelHub.
1. Pull and merge to synchronize with the tip.
1. Perform the schema import in a local transaction.
1. Push the results of the schema import as a ChangeSet to iModelHub.

After applying a schema ChangeSet, the IModelDb must be closed and reopened.