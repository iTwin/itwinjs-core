---
publish: false
---
# NextVersion

## Backend

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

### Async formats provider setter

[IModelApp.setFormatsProvider]($frontend) replaces the formats provider, optionally sets the active unit system through [SetFormatsProviderOptions.unitSystem]($frontend), and returns a promise that resolves after the [QuantityFormatter]($frontend) has rebuilt its formatting and parsing caches. Use it instead of assigning [IModelApp.formatsProvider]($frontend) when you need to know that formatting reflects the new provider.

- The provider and unit system take effect immediately: `IModelApp.formatsProvider` lookups, including `getFormatSync`, use the new provider, and `IModelApp.quantityFormatter.activeUnitSystem` reports the new unit system before the promise settles.
- If a later `setFormatsProvider` call is made before the reload finishes, the earlier promise rejects. The latest provider wins.
- If the reload fails, the promise rejects and the new provider stays installed. The formatter remains usable, but some cached formats may still come from the previous provider.
- The promise also rejects if the application shuts down before the reload finishes.

Assigning `IModelApp.formatsProvider` still works and still starts the same reload, but it gives you nothing to await.
