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
* An app works with a [briefcase](../Glossary.md#Briefcase) using the [IModelDb]($imodeljs-backend.IModelDb) class.
* A briefcase has a unique identity that is issued and tracked by [iModelHub](../../overview/IModelHub.md).
* Changes are captured and distributed in the form of [ChangeSets](../Glossary.md#ChangeSets).
* ChangeSets are ordered in a sequence that is called the [timeline](../../overview/IModelHub.md#the-timeline-of-changes) of the iModel.
* ChangeSets are stored in iModelHub
* A [Code](../Glossary.md#Code) is an identifier that assigned to an element and is managed by a central Code Service.

## Glossary:

|Term | Definition
|------------|------------|--------|--------|-------|
|**Base**|One ChangeSet is based on another if it occurs later in the [timeline](../../overview/IModelHub.md#the-timeline-of-changes).
|**Change-merging**|Same as merge.
|**Code Reservation**|The right to use a Code
|**Concurrency Control**|How to coordinate simultaneous transactions while preserving data integrity.
|**Concurrency Control Policy**|The rules that apps must follow when changing models and elements. May be [optimistic](#optimistic) or [pessimistic](#pessimistic).
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
|**Transaction**|A set of changes that are committed or abandoned atomically, making up a unit of work. Multiple  transactions to a briefcase are combined into a [ChangeSet](../Glossary.md#ChangeSets).


## Code Reservation

An app must reserve all Codes that it plans to assign to elements during a local editing session. An app can reserve more Codes than it actually uses. For example, an app may reserve a range or block of Codes in a sequence in order to ensure that it can use them, but before it knows exactly how many it will need. When the local ChangeSet is finally pushed, the Code Service sorts out which reserved Codes were actually used and which were not. Unused Codes are returned to the pool, while used Codes are marked as used and unavailable. When an element is deleted, its Code may be returned to the pool(??).

Note that the optimistic concurrency control policy does not apply to Codes.

## Data Write Concurrency Control Policies

 Preemptive locking is always required when importing Schemas or changing or inserting CodeSpecs. The APIs for those objects take care of locking automatically, so there is nothing special for an app to do.

 For models and elements, there are two locking policy options: pessimistic and optimistic. The app implements the policy that is prescribed for the iModel.

### Pessimistic Concurrency Control

The pessimistic concurrency policy requires that models and elements must be locked before local changes can be pushed to iModelHub.

For reference, the pessimistic locking rules are as follows:
|Operation|LockType|Lock Level|
|------------|------------|--------|--------|-------|
|Insert element|Model|Shared
|Modify element|Element|Exclusive|
|Delete element|Element|Exclusive|
|Insert model|DgnDb|Shared|
|Modify model|Model|Exclusive|
|Delete model|Model|Exclusive|
|            |Elements in model|Exclusive|

An app will normally implement the pessimistic policy by using high-level APIs to build lock requests based on the intended operation, as explained [below](#acquiring-locks-and-reserving-codes).

Locks are normally released when the briefcase pushes its changes, or they may be released if the briefcase abandons its changes.

### Optimistic Concurrency Control

 An optimistic concurrency policy allows apps to modify elements and models in an iModel without acquiring locks. This opens up the possibility that other apps may add ChangeSets to the timeline while the local editing session is in progress. In that case, when these ChangeSets are merged into the local briefcase, the merge algorithm checks for conflicts. If conflicts are found, it applies the [conflict-resolution policy]($imodeljs-backend.ConcurrencyControl.ConflictResolutionPolicy) that is part of the iModel's optimistic concurrency policy. A conflict-resolution policy may specify that, when an in-coming change conflicts with a local change, the in-coming change may be accepted, replacing the local change, or the in-coming change may be rejected, retaining the local change instead. Resolution policies are specified for the various combinations of changes that could conflict, including update vs. update, update vs. delete, and delete vs. update. Conflict detection and resolution is done at the level of individual element properties. So, it is very fine-grained. That allows many kinds of changes to be made simultaneously without conflicting in this most basic sense. A schema may also specify rules to check for conflicts on a higher level.

 Only models and elements may be changed optimistically. Locking is required when importing Schemas or changing or inserting CodeSpecs.

## Acquiring Locks and Reserving Codes

A briefcase must reserve codes before pushing a ChangeSet to iModelHub. Under a pessimistic policy, the briefcase must also acquire all needed locks before pushing. The app has two options for when and how to acquire locks and/or codes during a local transaction: before making changes (preemptively) or after making changes (bulk mode).

### Acquiring locks and/or codes preemptively

 1. Call [Model.buildConcurrencyControlRequest]($imodeljs-backend.Model.buildConcurrencyControlRequest) and [Element.buildConcurrencyControlRequest]($imodeljs-backend.Element.buildConcurrencyControlRequest) to discover what locks and codes would be needed before making local changes.

 1. Call [ConcurrencyControl.request]($imodeljs-backend.ConcurrencyControl.request) to request the locks and/or codes that the planned local operations will require. This may send a request to iModelHub.
  ==> If the request fails, roll back the local transaction and cancel the local operation.
 1. If the request succeeds, go ahead and make the planned local changes and then call [IModelDb.saveChanges]($imodeljs-backend.IModelDb.saveChanges).

 This approach is the safest way to avoid conflicts. It requires that the app must plan ahead before making local changes.

 Note that sending a request to iModelHub is a relative expensive operation. Therefore to batch up requests for locks and/or Codes.

### Acquiring locks and/or codes in bulk mode

 1. Insert or update models and elements.

 1. Call [ConcurrencyControl.request]($imodeljs-backend.ConcurrencyControl.request) to request the locks and codes that those local operations require.
  ==> If the request fails, call [IModelDb.cancelChanges]($imodeljs-backend.IModelDb.cancelChanges) to roll back the local transaction.
 1. If the request succeeds, call [IModelDb.saveChanges]($imodeljs-backend.IModelDb.saveChanges) to commit the local transaction.

 Using bulk mode is simpler than using the preemptive approach, but it carries the risk that you must abandon all of your changes in case of a locking or code-reservation conflict. Use this approach only if you know that your changes are isolated such that conflicts are unlikely.

## ChangeSets and Schema Changes

The special schema lock must be acquired before importing a schema into a briefcase. Also, schema changes must be isolated in a dedicated ChangeSet, separate from other kinds of changes. In practice, that means that an app that wants to import a schema must:
1. Push any local changes to iModelHub.
1. Pull and merge in order to synchronize with the tip.
1. Perform the schema import in a local transaction.
1. Push the results of the schema import as a ChangeSet to iModelHub.

After applying a schema ChangeSet, the IModelDb must be closed and reopened.