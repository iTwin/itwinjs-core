---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Opt-in V8 serialization for concurrent queries](#opt-in-v8-serialization-for-concurrent-queries)
    - [Opportunistic cursor reuse for asynchronous ECSQL paging](#opportunistic-cursor-reuse-for-asynchronous-ecsql-paging)
    - [Opt-in fallback for missing navigation relationship class ids](#opt-in-fallback-for-missing-navigation-relationship-class-ids)
  - [Common](#common)
    - [Step-interpolated render schedule keyframes no longer apply one keyframe late](#step-interpolated-render-schedule-keyframes-no-longer-apply-one-keyframe-late)

## Backend

### Opt-in V8 serialization for concurrent queries

Backend concurrent-query configuration adds `useV8Serialization` (default `false`).
Set it to `true` to encode rendered query rows on native workers with `v8serial`
and decode them in the backend with `node:v8.deserialize`. Backend query readers
continue receiving ordinary row arrays. Set it to `false` to retain JSON transport.
The flag can also be supplied in the native `CONCURRENT_QUERY_CONFIG`
environment variable.

This requires the corresponding rebuilt native addon. Explicitly enabling the
option with an older addon throws instead of silently using JSON. Raw native
JavaScript callers receive a `Uint8Array` in `data`, marked `dataEncoding: "v8"`,
and must deserialize it themselves. Native C++ readers retain their default JSON
format; BlobIO is unchanged.

IDs, dates, class names and base64-prefixed blobs retain their existing string
representations; non-finite numbers remain `null`. Memory quotas count the
encoded bytes, so page boundaries can differ between transports. Node 20, 22 and
24 use the supported version-15 wire format. Treat serialized payloads as
process-local transport, not a persistent storage format.

### Opportunistic cursor reuse for asynchronous ECSQL paging

Asynchronous ECSQL readers can now resume unfinished concurrent-query statements between contiguous batches, avoiding repeated scans through preceding rows and repeated sorting. Reuse is bounded by the statement cache, prefers an available owning worker, and falls back to LIMIT/OFFSET after expiration, cache eviction, or an observed committed data change.

Backend concurrent-query configuration adds `enableCursors` (default `true`), `maxCursorsPerWorker` (default `-1`, selecting the statement-cache size for read-only primaries or four for writable WAL databases), and `cursorIdleTimeout` (default 30 seconds). Set `enableCursors: false` or `maxCursorsPerWorker: 0` to retain the previous per-batch re-execution behavior. Primary-connection queries, non-WAL databases (including read-only handles), and connections with attached data databases continue using that behavior.

Queries with nondeterministic expressions can now evaluate those expressions once for a retained execution instead of once per batch. Use deterministic queries and ordering for reliable paging, or disable cursor reuse when per-batch re-evaluation is required. Parked statements can retain sorter resources and delay WAL checkpoints until invalidation or expiration.

### Opt-in fallback for missing navigation relationship class ids

Added `ECSQLOPTIONS NAV_REL_CLASSID_FALLBACK` for legacy navigation properties that contain an `Id` but no `RelECClassId`. When enabled, end-table relationship queries and `ECVLib.Relations()` report the relationship declared by the navigation property. Existing behavior is unchanged when the option is omitted, and directly selecting the navigation property's `RelECClassId` still returns its stored `NULL` value.

The option adds compatibility predicates that can result in less efficient query plans, so applications should enable it only for queries that need to read affected legacy data. `ECVLib.Relations()` also requires `ENABLE_EXPERIMENTAL_FEATURES`.

The ECSQL version was bumped to `2.0.4.2`.

## Common

### Step-interpolated render schedule keyframes no longer apply one keyframe late

Querying a [RenderSchedule.Timeline]($common) at a time that exactly matches one of its keyframes returned the *preceding* keyframe's value when that preceding keyframe used [RenderSchedule.Interpolation.Step]($common). It now returns the matched keyframe's own value. This affects [RenderSchedule.Timeline.getVisibility]($common), [RenderSchedule.Timeline.getColor]($common), [RenderSchedule.Timeline.getAnimationTransform]($common), and [RenderSchedule.Timeline.getCuttingPlane]($common).

For a step visibility timeline with keyframes `100 -> 80`, `200 -> 50`, and `300 -> 0`, querying at time 200 previously returned 80 and now returns 50.

The change only affects queries at a time exactly equal to a keyframe's time, only for keyframes other than the first and last, and only when the preceding keyframe uses [RenderSchedule.Interpolation.Step]($common).
