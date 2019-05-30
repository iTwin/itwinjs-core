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

## Changes to tile features

Removed or modified some properties used to feature-gate various tile-related features.

Frontend:
  * Removed `TileAdmin.requestTilesWithoutEdges`. Tiles are now always requested without edges if edges are not required.
  * Removed `TileAdmin.elideEmptyChildContentRequests`. Such requests are now always elided.
  * `TileAdmin.enableInstancing` now defaults to `true` instead of `false`.
  * Previously, if `TileAdmin.retryInterval` was undefined, requests for tile content and tile tree JSON would not be memoized. Now, they are always memoized, and the interval defaults to 1000ms if not explicitly defined.
  * Previously, requests for tile content would by default use POST method and responses would not be cacheable. Now by default they use GET and responses are cacheable.

Backend:
  * Removed `IModelHostConfiguration.useTileContentThreadPool`. The thread pool is now always used.

## Changes to RPC type marshaling system

The iModel.js RPC system now permits only primitive values, "interface" objects that contain only data values, and binary data over the wire. Therefore, all RPC interface methods can only accept and return these types now.

It is no longer possible to send class instances, maps, sets, or objects with function members between the frontend and backend using the RPC system.

Binary data transfer is still supported via `Uint8Array`.

These new type restrictions are enforced via the `require-basic-rpc-values` tslint rule. With these new restrictions in place, the RPC system is now compatible with aggressive webpacking policies that mangle class names at build time.


## Changes to ECSql Query API

This change breaks RPC interface [IModelReadRpcInterface]($common). Both frontend and backend developer must update there packages.

Backend:
  * Renamed `IModelDb.queryPage` to [IModelDb.queryRows]($backend). This method is also marked `internal` and user should not call it directly. Instead user should always use [IModelDb.query]($frontend). This method now also throw exception if query prepare fails.
  * Changed methoid signature for [IModelDb.query]($backend). But first two parameters are same.

Common:
  * Renamed `IModelDb.queryPage` to [IModelDb.queryRows]($common).
  * Removed `queryRowCount`method from [IModelReadRpcInterface]($common)

Backend:
  * Renamed `IModelDb.queryPage` to [IModelConnection.queryRows]($frontend). This method is also marked `internal` and user should not call it directly. Instead user should always use [IModelConnection.query]($frontend). This method now also throw exception if query prepare fails.
  * Changed methoid signature for [IModelDb.query]($backend). But first two parameters are same.

### How can you update code
```ts
      const rows = await imodel.queryPage("SELECT ECInstanceId FROM bis.Element LIMIT 1");
```
  can be be changed to following.
```ts
      const rows = [];
      for await (const row of imodel.query("SELECT ECInstanceId FROM bis.Element LIMIT 1")) {
        rows.push(row);
      }
```