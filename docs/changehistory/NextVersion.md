---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Quantity formatting](#quantity-formatting)
    - [Bearing and Azimuth formatting now respects the persistence unit's phenomenon](#bearing-and-azimuth-formatting-now-respects-the-persistence-units-phenomenon)
  - [Electron](#electron)
    - [Electron 43 support](#electron-43-support)
    - [Backend-to-frontend IPC invoke](#backend-to-frontend-ipc-invoke)
  - [@itwin/core-backend](#itwincore-backend)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)
  - [@itwin/core-geometry](#itwincore-geometry)
    - [Region Boolean enhancements](#region-boolean-enhancements)

## Quantity formatting

### Bearing and Azimuth formatting now respects the persistence unit's phenomenon

Previously, [Bearing and Azimuth format types]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) assumed the persisted magnitude was always a true azimuth (measured clockwise from north), regardless of the quantity's `persistenceUnit`. This was incorrect for properties whose `persistenceUnit.phenomenon` is `Units.ANGLE` (a raw mathematical angle, measured counter-clockwise from east) - see [#9465](https://github.com/iTwin/itwinjs-core/issues/9465).

[Formatter.formatQuantity]($quantity) and [Parser.parseQuantityString]($quantity) now branch on `persistenceUnit.phenomenon`:

- `Units.HORIZONTAL_DIRECTION` (a phenomenon; e.g. its `Units.HORIZONTAL_DIR_RAD` unit): unchanged - a `HORIZONTAL_DIRECTION` value is already a true azimuth, so it's formatted/parsed as-is.
- `Units.ANGLE` (a phenomenon; e.g. its `Units.RAD` unit): the `90° − θ` conversion is now applied automatically before formatting an `ANGLE` value, and inverse-applied after parsing one.

For code that persists Bearing/Azimuth values as `ANGLE`-phenomenon units and previously worked around the bug by manually applying its own `90° − θ` correction: **that manual correction must now be removed**, or values will be double-converted. For example, `AccuDraw`'s manual correction for its `QuantityType.Angle` bearing display (persisted as `Units.RAD`) has been removed as part of this change.

If your KindOfQuantity persists true azimuth values directly, switch its persistence unit to a `Units.HORIZONTAL_DIRECTION` unit (e.g. `Units.HORIZONTAL_DIR_RAD`) to opt out of the conversion entirely.

**Note:** if you switch your persistence unit's phenomenon, remember to also update `revolutionUnit` (and `azimuthBaseUnit`, if set) to a unit from the same phenomenon - e.g. `Units.HORIZONTAL_DIR_REVOLUTION` instead of `Units.REVOLUTION` for a `Units.HORIZONTAL_DIRECTION` persistence unit. These units cannot be converted across phenomena, so a mismatch will fail to resolve. See [Bearing and Azimuth Format]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) for details.

## Electron

### Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).

### Backend-to-frontend IPC invoke

For apps with a dedicated backend, the backend can now invoke methods on the frontend and receive a return value, mirroring the existing frontend-to-backend pattern. Previously [IpcHost]($backend) could only `send` one-way messages to the frontend; the reverse request/response direction had no equivalent of [IpcSocketFrontend.invoke]($common).

The new `@beta` APIs are:

- `IpcHost.invoke` and `IpcHost.makeIpcProxy` on the backend to call frontend handlers.
- `IpcApp.handle` and a new `IpcHandler` base class on the frontend to implement them.

```typescript
// common: the shared interface
export interface EchoInterface {
  echo: (message: string) => Promise<string>;
}

// frontend: implement and register the handler
import { IpcHandler } from "@itwin/core-frontend";

class EchoHandler extends IpcHandler implements EchoInterface {
  public get channelName() { return "echo-channel"; }
  public async echo(message: string) { return `echo: ${message}!`; }
}
EchoHandler.register();

// backend: call it through a type-safe proxy
import { IpcHost } from "@itwin/core-backend";

const proxy = IpcHost.makeIpcProxy<EchoInterface>("echo-channel");
const result = await proxy.echo("hello"); // "echo: hello!"
```

Because Electron provides no native main-to-renderer `invoke` (only one-way `webContents.send`), this is implemented on top of the existing `send`/`addListener` primitives, so it works over both the Electron IPC and web socket transports (mobile included, since it runs over web sockets).

Pending invocations are rejected if [IpcHost.shutdown]($backend) is called before a response arrives, so promises never leak past shutdown.

When a frontend handler throws, the error is surfaced to the backend caller following the [ITwinError]($bentley) paradigm: it is rebuilt as an `Error` preserving the message, `iTwinErrorId`, error number, logging metadata, and any custom properties, so the caller can identify it with [ITwinError.isError]($bentley) (or [BentleyError.isError]($bentley) for legacy error numbers) rather than relying on a class identity that cannot survive marshalling across the Ipc boundary. A non-`BentleyError` (e.g. a plain `Error`) is re-thrown with its message and any own-enumerable properties preserved. (The existing frontend-to-backend direction continues to rethrow a backend `BentleyError` as the pre-existing [BackendError]($common) for backwards compatibility.)

## @itwin/core-backend

### WorkspaceDb file resource APIs deprecated

The [WorkspaceDb.getFile]($backend), [EditableWorkspaceDb.addFile]($backend), [EditableWorkspaceDb.updateFile]($backend), and [EditableWorkspaceDb.removeFile]($backend) APIs are deprecated. Store binary resources with [EditableWorkspaceDb.addBlob]($backend), or text resources with [EditableWorkspaceDb.addString]($backend), so applications can read their contents directly from the [WorkspaceDb]($backend).

```ts
// Before
editableDb.addFile("equipment-data", localFileName);
const extractedFileName = workspaceDb.getFile("equipment-data");

// After
editableDb.addBlob("equipment-data", fs.readFileSync(localFileName));
const contents = workspaceDb.getBlob("equipment-data");
```

The deprecated methods remain functional so existing file resources can be read, replaced, migrated, or removed. If still using `addFile()`, new file extensions now reject characters that are invalid in cross-platform filenames, and existing resources with unsafe extension metadata use an extensionless generated cache filename.

### ChangesetReader.setBatchSize

[ChangesetReader]($backend) now exposes a `setBatchSize(n: number)` method that controls how many change rows are cached in the reader. It is a performance improvement parameter that can be tweaked as per user's choice. Increasing the batch size increases the number of rows read at once and cached in the reader, thereby improving throughput when iterating large changesets but it also increases memory consumption; decreasing it reduces peak memory use. The method must be called before the first [ChangesetReader.step]($backend) call.

Default batch sizes (unchanged behaviour when `setBatchSize` is not called):

| Active configuration | Default |
|---|---|
| `propFilter: InstanceKey` | 100 |
| `propFilter: BisCoreElement` | 20 |
| `propFilter: All`, `abbreviateBlobs: false` | 5 |
| `propFilter: All` (blobs abbreviated or unset) | 10 |

```ts
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setBatchSize(10);
while (reader.step()) { /* ... */ }
```

**Performance improvement with new caching behaviour in ChangesetReader`**:

| Cache type | Inserts | Before (s) | After (s) | Improvement |
|---|---|---|---|---|
| InMemoryCache | 1,000 | 0.220 | 0.204 | 7.3% |
| InMemoryCache | 10,000 | 2.213 | 1.402 | 36.6% |
| SqliteBackedCache | 1,000 | 0.399 | 0.207 | 48.1% |
| SqliteBackedCache | 10,000 | 3.342 | 1.981 | 40.7% |

## @itwin/core-geometry

### Region Boolean enhancements

[RegionOps.regionBooleanXY]($core-geometry) has improved simplification and new options in the [RegionBooleanXYOptions]($core-geometry) options bundle:
| Option name | Type | Default Value | Description |
|---|---|---|---|
| `simplifyUnion` | boolean | `false` | When `true`, holes are now preserved. |
| `operationGroupA` | [RegionBinaryOpType]($core-geometry) | `RegionBinaryOpType.Union` | Operation to apply to the regions of the first input argument. |
| `operationGroupB` | [RegionBinaryOpType]($core-geometry) | `RegionBinaryOpType.Union` | Operation to apply to the regions of the second input argument. |

#### RegionBooleanXYOptions.simplifyUnion

The default behavior of `RegionOps.regionBooleanXY` results in `UnionRegion`s with algorithmically inserted bridge edges removed, but with other interior edges remaining. The previous `true` behavior for this option applied only to `RegionBinaryOpType.Union` operations, and simplified the output by returning only the outer loop, but at the cost of losing all implied holes, which was less than desirable. Now passing `simplifyUnion: true` not only removes interior edges, but also preserves holes, and returns the simplest region type for _all_ operations, not just unions.

For example, consider the union of four trapezoids to form a "picture frame". The following call produces a (rather naive!) `UnionRegion` in which the four input `Loop`s survive as children, and the hole is only implied---it cannot be queried:
```ts
const result = RegionOps.regionBooleanXY([trap0, trap1, trap2, trap3], undefined, RegionBinaryOpType.Union);
```
![Default Union](./assets/picture-frame-default.jpg "Default Boolean union results in a UnionRegion")

When we pass `simplifyUnion: true`, the result is now a `ParityRegion`. This simpler output not only lacks extraneous interior edges, but also explicitly captures the outer and hole `Loop`s as children:
```ts
const result = RegionOps.regionBooleanXY([trap0, trap1, trap2, trap3], undefined, RegionBinaryOpType.Union, { simplifyUnion: true });
```
![Simplified Union](./assets/picture-frame-simplified.jpg "Simplified Boolean union results in a ParityRegion")

#### RegionBooleanXYOptions.operationGroupA/B

The previous/default behavior of `RegionOps.regionBooleanXY` assumes an implicit union of the regions in each input group. With these new options, you can now specify intersection and parity operations to be performed on the regions in each group, before the main Boolean operation is performed on the groups.

So for example, consider subtracting the intersection of a 4-loop (green) Venn diagram's inner region from an outer (red) loop:

![Venn Input Loops](./assets/venn-loops.jpg "Green Venn loops, red outer loop")

Before the new options, you would have to call this method 4 times: 3 pairwise Boolean intersections among the Venn loops, and a Boolean difference. Now you can compute the `ParityRegion` result all in one go:
```ts
const result = RegionOps.regionBooleanXY([venn0, venn1, venn2, venn3], outer, RegionBinaryOpType.Parity, { simplifyUnion: true, operationGroupA: RegionBinaryOpType.Intersection });
```
![Venn Output Region](./assets/venn-boolean-in-one-go.jpg "Outer loop minus Venn intersection")

Note: The same result can also be obtained with `RegionBinaryOpType.BMinusA` instead of `RegionBinaryOpType.Parity`. To perform only the 4-way intersection, pass `undefined` for the second input group.
