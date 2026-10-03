---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Opt-in fallback for missing navigation relationship class ids](#opt-in-fallback-for-missing-navigation-relationship-class-ids)
  - [Common](#common)
    - [Step-interpolated render schedule keyframes no longer apply one keyframe late](#step-interpolated-render-schedule-keyframes-no-longer-apply-one-keyframe-late)
    - [Cursor paging for ECSqlReader](#cursor-paging-for-ecsqlreader)

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

### Cursor paging for ECSqlReader

Large ECSQL result sets are returned in pages, and by default each page re-runs the query and steps past `OFFSET` rows, so reading a large result costs O(n²) row steps. The new @beta `QueryOptions.useCursor` (or `QueryOptionsBuilder.setUseCursor(true)`) lets a backend retain the statement for a partial page and resume it for the next page. Resumed pages share the read snapshot of the first page. If the cursor is unavailable (evicted, expired after 30 seconds of inactivity, invalidated by a data change, or the next page is served by a different backend process), paging falls back to the previous offset behavior. Exit a `for await` loop early, or call `ECSqlReader.return()`, to release the cursor promptly.

If a page request is in flight, `return()` waits for it before releasing the returned cursor and discards the page's rows. A failed cursor close is reported to the caller and can be retried by calling `return()` again.

```ts
const reader = iModelDb.createQueryReader("SELECT ECInstanceId, GeometryStream FROM bis.GeometricElement3d", undefined, { useCursor: true });
for await (const row of reader) {
  // ...
}
```
