---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Faster asynchronous ECSQL paging and result conversion](#faster-asynchronous-ecsql-paging-and-result-conversion)
    - [Vertical CRS discovery](#vertical-crs-discovery)
    - [Opt-in fallback for missing navigation relationship class ids](#opt-in-fallback-for-missing-navigation-relationship-class-ids)
    - [Pre-push validation](#pre-push-validation)
    - [Stricter briefcase file deletion](#stricter-briefcase-file-deletion)
    - [IdSet accepts ids with the high bit set](#idset-accepts-ids-with-the-high-bit-set)
    - [Native ChangeUnifier](#native-changeunifier)
    - [Batched relationship lookups](#batched-relationship-lookups)
  - [Common](#common)
    - [Step-interpolated render schedule keyframes no longer apply one keyframe late](#step-interpolated-render-schedule-keyframes-no-longer-apply-one-keyframe-late)
    - [BeAsyncEvent](#beasyncevent)
  - [Quantity](#quantity)
    - [Built-in length ratio units for drawing scales](#built-in-length-ratio-units-for-drawing-scales)
    - [Async formats provider setter](#async-formats-provider-setter)
  - [@itwin/ecschema-metadata](#itwinecschema-metadata)
    - [SchemaView: property overrides use metadata of the overridden property](#schemaview-property-overrides-use-metadata-of-the-overridden-property)
  - [Breaking changes](#breaking-changes)
    - [Extensible sub-model class validation](#extensible-sub-model-class-validation)
    - [Mobile RPC authentication](#mobile-rpc-authentication)
    - [Non-finite geographic conversion results](#non-finite-geographic-conversion-results)

## Backend

### Faster asynchronous ECSQL paging and result conversion

Asynchronous ECSQL readers can now resume unfinished concurrent-query statements between contiguous batches, avoiding repeated scans through preceding rows and repeated sorting. A continuation briefly waits for a busy owning worker before falling back to another available worker. Reuse is temporary and bounded; expiration, cache eviction, or an observed committed data change returns paging to the existing LIMIT/OFFSET path.

Concurrent queries also reduce repeated metadata lookups and temporary JSON allocations when converting supported scalar and composite results. Point-coordinate reuse and more efficient ID formatting reduce per-row work without changing the documented result formats.

Reuse is automatic for eligible worker queries in WAL databases. Primary-connection queries, databases not using WAL journal mode (even when opened read-only), and connections with attached data databases continue re-executing each batch. Nondeterministic expressions may be evaluated once for a retained execution instead of once per batch, so use deterministic queries and ordering rather than depending on batch boundaries for re-evaluation. Retained statements can hold sorter resources and delay WAL checkpoints until released.

See [Asynchronous paging](../learning/backend/ExecutingECSQL.md#asynchronous-paging) for behavior and resource considerations.

### Vertical CRS discovery

The new beta [getAvailableVerticalCoordinateReferenceSystems]($backend) function returns an array of available vertical coordinate reference systems. Results can be filtered by geographic point or extent and by unit name. Unlike the similar [getAvailableCoordinateReferenceSystems]($backend) function, this function is not `async`.

### Opt-in fallback for missing navigation relationship class ids

Added `ECSQLOPTIONS NAV_REL_CLASSID_FALLBACK` for legacy navigation properties that contain an `Id` but no `RelECClassId`. When enabled, end-table relationship queries and `ECVLib.Relations()` report the relationship declared by the navigation property. Existing behavior is unchanged when the option is omitted, and directly selecting the navigation property's `RelECClassId` still returns its stored `NULL` value.

The option adds compatibility predicates that can result in less efficient query plans, so applications should enable it only for queries that need to read affected legacy data. `ECVLib.Relations()` also requires `ENABLE_EXPERIMENTAL_FEATURES`.

The ECSQL version was bumped to `2.0.4.2`.

### Pre-push validation

The new [TxnManager.onPrePushValidation]($backend) [asynchronous event](#beasyncevent) allows listeners to be notified just before a changeset is pushed to iModel Hub. The event allows last-minute edits to the iModel as well as the possibility to forbid the push to proceed.

### Stricter briefcase file deletion

[NativeApp.deleteBriefcase]($frontend) now only deletes files that are inside the briefcase cache directory or that are valid iModels. If the supplied path refers to an existing file that is neither, it throws an [IModelError]($common) with [IModelStatus.BadRequest]($bentley) and deletes nothing. If the path does not exist and is outside the briefcase cache, the call does nothing.

[BriefcaseManager.deleteBriefcaseFiles]($backend) no longer deletes every file in the same directory whose name starts with the briefcase's file name. Only files named `<briefcase file name>-*` or `<briefcase file name>.*` (e.g. `-wal`, `-shm`, `-locks`, `.Tiles`) are deleted along with the briefcase.

### IdSet accepts ids with the high bit set

The ECSQL `IdSet` virtual table rejected valid ids at or above `0x8000000000000000`. Element ids reserved by schema synchronization (`0xfffff6…`) are in that range, as are ids created by any briefcase whose id is `0x800000` or higher (element ids store the 24-bit briefcase id in their top bits). Queries such as `SELECT id FROM IdSet(?)` failed with `IdSet vtab: The element with index N is invalid`. When the set was given as hex strings in a JSON array and was therefore accepted, `WHERE id = ?` and `WHERE id IN (...)` filters on `IdSet` still returned no rows for those ids. `IdSet` now returns these ids whether they are bound with [QueryBinder.bindIdSet]($common), [ECSqlBinder.bindIdSet]($backend), or passed as a JSON array.

Because SQLite stores ids as signed 64-bit integers, a negative integer in an `IdSet` JSON array is now read as the id with the same bits. For example, `IdSet('[-1]')` returns `0xffffffffffffffff` instead of failing. `0`, non-integer numbers, and negative numbers written as strings are still rejected. JavaScript numbers cannot represent ids above 2^53 exactly, so pass ids as hex strings or bind them with `bindIdSet` rather than building a JSON array from JavaScript numbers.

### Native ChangeUnifier

The new `@beta` [ChangeUnifier]($backend) merges the per-table rows of [ChangesetReader]($backend)s into complete EC instances in native code. Memory stays bounded because merged data beyond a memory budget is spilled to temporary files, and `propNames` keeps only the properties you need. See [ChangeUnifier — native merging with bounded memory](../learning/backend/ChangesetReader.md#changeunifier--native-merging-with-bounded-memory) for usage and how it differs from [PartialChangeUnifier]($backend).

### Batched relationship lookups

The new `@beta` [Relationships.queryInstancesProps]($backend) and [Relationships.queryInstances]($backend) methods look up many relationships of the same class with at most two queries. Each criterion is either a relationship id or a source and target id pair, and both kinds can be mixed. The returned array has one entry per criterion, in the same order, with `undefined` where no relationship was found. The results match calling [Relationships.tryGetInstanceProps]($backend) or [Relationships.tryGetInstance]($backend) for each criterion.

```ts
const rels = await iModel.relationships.queryInstances<ElementGroupsMembers>(ElementGroupsMembers.classFullName, [relId, { sourceId, targetId }]);
```

By default, the queries run on the primary connection, so unsaved changes are visible. Pass `{ usePrimaryConn: false }` to use a concurrent query connection, which only sees saved changes.

## Common

### Step-interpolated render schedule keyframes no longer apply one keyframe late

Querying a [RenderSchedule.Timeline]($common) at a time that exactly matches one of its keyframes returned the *preceding* keyframe's value when that preceding keyframe used [RenderSchedule.Interpolation.Step]($common). It now returns the matched keyframe's own value. This affects [RenderSchedule.Timeline.getVisibility]($common), [RenderSchedule.Timeline.getColor]($common), [RenderSchedule.Timeline.getAnimationTransform]($common), and [RenderSchedule.Timeline.getCuttingPlane]($common).

For a step visibility timeline with keyframes `100 -> 80`, `200 -> 50`, and `300 -> 0`, querying at time 200 previously returned 80 and now returns 50.

The change only affects queries at a time exactly equal to a keyframe's time, only for keyframes other than the first and last, and only when the preceding keyframe uses [RenderSchedule.Interpolation.Step]($common).

### BeAsyncEvent

[BeAsyncEvent]($bentley) is similar to [BeEvent]($bentley) in that it allows any number of listeners to be notified when something happens. The difference is that, in the case of [BeAsyncEvent]($bentley), the listener is expected to return a `Promise`. Only after the returned `Promise` settles is the listener considered to have finished handling the event.

## Quantity

### Built-in length ratio units for drawing scales

The built-in unit set in `@itwin/core-quantity` now follows BIS Units schema 01.00.12, which adds three `LENGTH_RATIO` units: `Units.DECIMAL_LENGTH_RATIO`, `Units.M_PER_M_LENGTH_RATIO` (label `m:m`), and `Units.IN_PER_FT_LENGTH_RATIO` (label `in:ft`). These are intended for persisting drawing and sheet scales as paper length divided by model length, so a `1:100` scale is stored as `0.01` and a `1/4" = 1'` scale is stored as `1/48` in `m:m` (or `0.25` in `in:ft`).

[UnitConversions]($quantity) can convert between these units, and [getDefaultPersistenceUnit]($quantity) now accepts `Phenomena.LENGTH_RATIO` and returns `Units.M_PER_M_LENGTH_RATIO`. Previously `LENGTH_RATIO` was excluded from that helper because no built-in default existed.

### Async formats provider setter

[IModelApp.setFormatsProvider]($frontend) replaces the formats provider, optionally sets the active unit system through [SetFormatsProviderOptions.unitSystem]($frontend), and returns a promise that resolves after the [QuantityFormatter]($frontend) has rebuilt its formatting and parsing caches. Use it instead of assigning [IModelApp.formatsProvider]($frontend) when you need to know that formatting reflects the new provider.

- The provider and unit system take effect immediately: `IModelApp.formatsProvider` lookups, including `getFormatSync`, use the new provider, and `IModelApp.quantityFormatter.activeUnitSystem` reports the new unit system before the promise settles.
- If a later `setFormatsProvider` call is made before the reload finishes, the earlier promise rejects. The latest provider wins.
- If the reload fails, the promise rejects and the new provider stays installed. The formatter remains usable, but some cached formats may still come from the previous provider.
- The promise also rejects if the application shuts down before the reload finishes.

Assigning `IModelApp.formatsProvider` still works and still starts the same reload, but it gives you nothing to await.

## @itwin/ecschema-metadata

### SchemaView: property overrides use metadata of the overridden property

In [SchemaView](../learning/metadata/SchemaView.md), when a class overrides a property without specifying a category or KindOfQuantity, `category` and `kindOfQuantity` on `SchemaView.Property` now return the values of the overridden property, matching the rest of the EC APIs. The new `isEffectivelyHidden` also considers `HiddenProperty` on overridden properties. Label, description and priority still come from the overriding declaration.

Classes using a mixin that overrides a property of its base mixin now get the overriding declaration.

## Breaking changes

### Extensible sub-model class validation

Validation of which model classes may sub-model an element has moved from the native library to [Element.onSubModelInsert]($backend).

The built-in rules remain:

- [Sheet]($backend) accepts [SheetModel]($backend) and its subclasses.
- [Drawing]($backend) accepts [DrawingModel]($backend) and its subclasses.
- [TemplateRecipe2d]($backend) accepts [DrawingModel]($backend) and its subclasses.
- [SectionDrawing]($backend) accepts [DrawingModel]($backend), [GraphicalModel3d]($backend), and their subclasses.

Domain element classes implementing `bis:ISubModeledElement` may restrict their permitted sub-model classes by overriding the protected static [Element.allowedSubModelClasses]($backend) getter. The default value, `undefined`, permits any model class. A model class derived from an allowed class is also accepted, including a generated JavaScript class for an unregistered EC subclass.

```ts
class SheetPrototype extends DefinitionElement {
  protected static override get allowedSubModelClasses(): Array<EntityClassType<Model>> {
    return [SheetModel];
  }
}
```

The following behavior changes apply:

- Inserting a disallowed model now throws [IModelError]($common) with [IModelStatus.WrongModel]($bentley). The corresponding native checks previously returned `IModelStatus.BadElement`.
- An override of [Element.onSubModelInsert]($backend) must call `super.onSubModelInsert(arg)` to retain inherited validation. An override that does not call `super` replaces that validation.
- Missing modeled elements and elements that do not implement `bis:ISubModeledElement` continue to be rejected by the native library.

This functionality requires the matching `@bentley/imodeljs-native` version distributed with `@itwin/core-backend`. Combining a native version containing the relaxed checks with an older `@itwin/core-backend` removes the built-in `Sheet` and `Drawing` restrictions.

### Mobile RPC authentication

Mobile RPC WebSocket connections now require a random per-launch token, preventing other applications on the device from accessing the backend through loopback. Connections without the token are rejected before RPC processing or pending-message delivery.

Upgrade the mobile native runtime together with both the frontend and backend copies of `@itwin/core-mobile`. The secured transport cannot use older native runtimes that do not deliver the token, and older frontends cannot connect to the secured backend. There is no unauthenticated fallback. Updated native runtimes remain compatible with older frontend/backend pairs.

No Mobile SDK changes are required when using the existing native host startup paths. On iOS, register the WebView with `IModelJsHost` before loading the frontend so the native host can inject the token at document start. On Android, `IModelJsHost.loadEntryPoint` supplies the token in the frontend URL fragment. Both native hosts supply the token when reconnecting after background suspension.

Custom native hosts must deliver the backend token to the trusted frontend out of band, using `window.__iTwinJsRpcToken` or the `rpcToken` URL fragment parameter, and include it as the second argument to `window._imodeljs_rpc_reconnect`. Do not obtain the token over the unauthenticated socket or include it in logs.

### Non-finite geographic conversion results

The GCS-based single-point and batch conversion methods on [IModelConnection]($frontend) now reject non-finite returned coordinates with `GeoServiceStatus.CSMapError`, even if the conversion reports success. Previously, coordinate normalization could turn an invalid ordinate into zero or return an infinite value. Finite successful results and the existing handling of failure statuses are unchanged. OPC point-cloud placement now warns and uses zero vertical correction when its computed correction is non-finite.

Handle these rejected promises instead of relying on normalized invalid elevations. Applications that deliberately use partial conversion results should use [GeoConverter]($frontend), inspect each [PointWithStatus]($common), and validate the ordinates they need. Status `26` (`GeoCoordStatus.VerticalDatumConvertError`) permits horizontal use but does not provide a reliable converted elevation, even when Z is finite. Connection convenience methods continue to reject this status; OPC's warning and zero-correction fallback is approximate display placement, not successful vertical conversion.

After fixing unavailable grid resources, do not reuse a retained converter's cached failure. Finish outstanding requests and obtain a fresh converter from `GeoServices.getConverter` to retry.
