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
  - [Common](#common)
    - [Step-interpolated render schedule keyframes no longer apply one keyframe late](#step-interpolated-render-schedule-keyframes-no-longer-apply-one-keyframe-late)
  - [Quantity](#quantity)
    - [Built-in length ratio units for drawing scales](#built-in-length-ratio-units-for-drawing-scales)
    - [Async formats provider setter](#async-formats-provider-setter)
  - [Breaking changes](#breaking-changes)
    - [Extensible sub-model class validation](#extensible-sub-model-class-validation)
    - [Mobile RPC authentication](#mobile-rpc-authentication)

## Backend

### Faster asynchronous ECSQL paging and result conversion

Asynchronous ECSQL readers can now resume unfinished concurrent-query statements between contiguous batches, avoiding repeated scans through preceding rows and repeated sorting. A continuation briefly waits for a busy owning worker before falling back to another available worker. Reuse is temporary and bounded; expiration, cache eviction, or an observed committed data change returns paging to the existing LIMIT/OFFSET path.

Concurrent queries also reduce repeated metadata lookups and temporary JSON allocations when converting supported scalar and composite results. Point-coordinate reuse and more efficient ID formatting reduce per-row work without changing the documented result formats.

Reuse is automatic for eligible worker queries in WAL databases. Primary-connection queries, non-WAL databases (including read-only handles), and connections with attached data databases continue re-executing each batch. Nondeterministic expressions may be evaluated once for a retained execution instead of once per batch, so use deterministic queries and ordering rather than depending on batch boundaries for re-evaluation. Retained statements can hold sorter resources and delay WAL checkpoints until released.

See [Asynchronous paging](../learning/backend/ExecutingECSQL.md#asynchronous-paging) for behavior and resource considerations.

### Vertical CRS discovery

The new beta [getAvailableVerticalCoordinateReferenceSystems]($backend) function returns an array of available vertical coordinate reference systems. Results can be filtered by geographic point or extent and by unit name. Unlike the similar [getAvailableCoordinateReferenceSystems]($backend) function, this function is not `async`.

### Opt-in fallback for missing navigation relationship class ids

Added `ECSQLOPTIONS NAV_REL_CLASSID_FALLBACK` for legacy navigation properties that contain an `Id` but no `RelECClassId`. When enabled, end-table relationship queries and `ECVLib.Relations()` report the relationship declared by the navigation property. Existing behavior is unchanged when the option is omitted, and directly selecting the navigation property's `RelECClassId` still returns its stored `NULL` value.

The option adds compatibility predicates that can result in less efficient query plans, so applications should enable it only for queries that need to read affected legacy data. `ECVLib.Relations()` also requires `ENABLE_EXPERIMENTAL_FEATURES`.

The ECSQL version was bumped to `2.0.4.2`.

## Common

### Step-interpolated render schedule keyframes no longer apply one keyframe late

Querying a [RenderSchedule.Timeline]($common) at a time that exactly matches one of its keyframes returned the *preceding* keyframe's value when that preceding keyframe used [RenderSchedule.Interpolation.Step]($common). It now returns the matched keyframe's own value. This affects [RenderSchedule.Timeline.getVisibility]($common), [RenderSchedule.Timeline.getColor]($common), [RenderSchedule.Timeline.getAnimationTransform]($common), and [RenderSchedule.Timeline.getCuttingPlane]($common).

For a step visibility timeline with keyframes `100 -> 80`, `200 -> 50`, and `300 -> 0`, querying at time 200 previously returned 80 and now returns 50.

The change only affects queries at a time exactly equal to a keyframe's time, only for keyframes other than the first and last, and only when the preceding keyframe uses [RenderSchedule.Interpolation.Step]($common).

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
