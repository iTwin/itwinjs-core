---
ignore: true
---
# NextVersion

## Changes to [SelectionSet]($frontend) events and HiliteSet

HilitedSet has been renamed to HiliteSet and marked `alpha`. It now supports hiliting models and subcategories in addition to elements. By default it continues to be synchronized with the SelectionSet, but this can be overridden (Grigas' presentation viewport component does so, enabling him to control the hilite set independently from the selection set).

SelectEventType enum has been renamed to [SelectionSetEventType]($frontend).

The argument to [SelectionSet.onChanged]($frontend) has changed to [SelectionSetEvent]($frontend). You can switch on the `type` field to access the sets of added and/or removed Ids; or access the current contents directly via the `set` field.

SelectionSet methods accepting an optional `sendEvent` argument have been marked private - it is not appropriate for external callers to suppress event dispatch.

## Refinements to *snapshot* iModel API

The `IModelDb.createSnapshotFromSeed` **static** method has been replaced by the [IModelDb.createSnapshot]($backend) **instance** method.
The reason is to make sure that the program/user had permission to open the iModel before making the *snapshot* copy.
A related change is that [IModelDb.openSnapshot]($backend) will no longer open briefcases.
Either [IModelDb.open]($backend) should be called to open the iModel or [IModelDb.createSnapshot]($backend) should have been called to make the *snapshot* ahead of time.

Here is an example of how to adjust your source code:

```ts
  const seedDb: IModelDb = IModelDb.openSnapshot(seedFileName); // or IModelDb.open
  const snapshotDb: IModelDb = seedDb.createSnapshot(snapshotFileName);
  seedDb.closeSnapshot(); // or IModelDb.close
  return snapshotDb;
```

## Changes to IModelDb.open API

Removed the following parameters to [IModelDb.open]($backend) to simplify the implementation:
* [OpenParams]($backend).pullOnly(): Use OpenParams.fixedVersion() or OpenParams.pullAndPush()
* AccessMode: Using OpenParams.fixedVersion() always causes the briefcase to be shared, and using OpenParams.pullAndPush() always causes the briefcase to be exclusive.
