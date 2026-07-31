---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
  - [Quantity formatting](#quantity-formatting)
    - [Bearing and Azimuth formatting now respects the persistence unit's phenomenon](#bearing-and-azimuth-formatting-now-respects-the-persistence-units-phenomenon)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
  - [Electron](#electron)
    - [Electron 43 support](#electron-43-support)
    - [Backend-to-frontend IPC invoke](#backend-to-frontend-ipc-invoke)
  - [@itwin/core-backend](#itwincore-backend-1)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)

## @itwin/core-backend

### Edit from element, model, and aspect callbacks

A new beta API, [IModelDb.getIndirectTxn]($backend), provides the [EditTxn]($backend) associated with an element, model, or aspect callback. Callbacks whose arguments provide an [IModelDb]($backend) but no transaction can use it to perform additional edits within the transaction that invoked the callback.

```ts
[[include:EditTxn.ElementCallback]]
```

The operation that invoked the callback owns the returned transaction. The callback must not start, end, save, abandon, or otherwise manage the transaction lifecycle. Callbacks that receive `indirectEditTxn` directly should continue using that property.

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
- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Edit from element, model, and aspect callbacks](#edit-from-element-model-and-aspect-callbacks)
    - [WorkspaceDb file resource APIs deprecated](#workspacedb-file-resource-apis-deprecated)
  - [Quantity formatting](#quantity-formatting)
    - [Bearing and Azimuth formatting now respects the persistence unit's phenomenon](#bearing-and-azimuth-formatting-now-respects-the-persistence-units-phenomenon)
    - [Quantity formatting for text annotation fields](#quantity-formatting-for-text-annotation-fields)
  - [Electron](#electron)
    - [Electron 43 support](#electron-43-support)
    - [Backend-to-frontend IPC invoke](#backend-to-frontend-ipc-invoke)
  - [@itwin/core-backend](#itwincore-backend-1)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)

## Quantity formatting

### Bearing and Azimuth formatting now respects the persistence unit's phenomenon

Previously, [Bearing and Azimuth format types]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) assumed the persisted magnitude was always a true azimuth (measured clockwise from north), regardless of the quantity's `persistenceUnit`. This was incorrect for properties whose `persistenceUnit.phenomenon` is `Units.ANGLE` (a raw mathematical angle, measured counter-clockwise from east) - see [#9465](https://github.com/iTwin/itwinjs-core/issues/9465).

[Formatter.formatQuantity]($quantity) and [Parser.parseQuantityString]($quantity) now branch on `persistenceUnit.phenomenon`:

- `Units.HORIZONTAL_DIRECTION` (a phenomenon; e.g. its `Units.HORIZONTAL_DIR_RAD` unit): unchanged - a `HORIZONTAL_DIRECTION` value is already a true azimuth, so it's formatted/parsed as-is.
- `Units.ANGLE` (a phenomenon; e.g. its `Units.RAD` unit): the `90° − θ` conversion is now applied automatically before formatting an `ANGLE` value, and inverse-applied after parsing one.

For code that persists Bearing/Azimuth values as `ANGLE`-phenomenon units and previously worked around the bug by manually applying its own `90° − θ` correction: **that manual correction must now be removed**, or values will be double-converted. For example, `AccuDraw`'s manual correction for its `QuantityType.Angle` bearing display (persisted as `Units.RAD`) has been removed as part of this change.

If your KindOfQuantity persists true azimuth values directly, switch its persistence unit to a `Units.HORIZONTAL_DIRECTION` unit (e.g. `Units.HORIZONTAL_DIR_RAD`) to opt out of the conversion entirely.

**Note:** if you switch your persistence unit's phenomenon, remember to also update `revolutionUnit` (and `azimuthBaseUnit`, if set) to a unit from the same phenomenon - e.g. `Units.HORIZONTAL_DIR_REVOLUTION` instead of `Units.REVOLUTION` for a `Units.HORIZONTAL_DIRECTION` persistence unit. These units cannot be converted across phenomena, so a mismatch will fail to resolve. See [Bearing and Azimuth Format]($docs/quantity-formatting/definitions/Formats.md#bearing-and-azimuth-format) for details.

### Quantity formatting for text annotation fields

[FieldRun]($common)s whose target property resolves to a `"quantity"` or `"coordinate"` value can now be rendered through the standard iTwin.js quantity formatting pipeline instead of the previous placeholder `toString()` representation. Field-level formatting is configured via a new [QuantityFieldFormatOptions]($common) block on [FieldFormatOptions]($common):

```typescript
const fieldRun = FieldRun.create({
  propertyHost: { elementId, schemaName: "MyDomain", className: "Widget" },
  propertyPath: { propertyName: "length" },
  formatOptions: {
    quantity: {
      // Look up a specific KindOfQuantity via the active FormatsProvider, overriding
      // the property's own KoQ.
      kindOfQuantity: "AecUnits.LENGTH",
    },
  },
});
```

A format is resolved in this priority order:

1. `formatOptions.quantity.format` — an inline [FormatProps]($core-quantity) override.
2. `formatOptions.quantity.kindOfQuantity` — a full KindOfQuantity name looked up via the active [FormatsProvider]($core-quantity).
3. The property's own [KindOfQuantity]($ecschema-metadata).
4. For `"coordinate"` only, a built-in meters fallback.

Because [FormatterSpec]($core-quantity) creation is asynchronous, quantity formatting is only applied when a field is evaluated through the new async entry point [ElementDrivesTextAnnotation.evaluateFieldsAsync]($backend):

```typescript
const numUpdated = await ElementDrivesTextAnnotation.evaluateFieldsAsync({ iModel, block });
```

The existing synchronous [ElementDrivesTextAnnotation.evaluateFields]($backend) and the `TxnManager` field-update callbacks continue to render `"quantity"` and `"coordinate"` fields as their raw string representation for backward compatibility. Applications that want formatted quantity output for text annotations should migrate their evaluation calls to the async variant.

Applications that own a [FormatsProvider]($core-quantity) and/or [UnitsProvider]($core-quantity) — for example, one backed by an adopted FormatSet — can route field formatting through them by passing them on [EvaluateFieldsAsyncArgs.formatting]($backend). Either provider may be omitted; any provider not supplied is defaulted to a schema-backed implementation derived from the iModel's schema context.

```typescript
const numUpdated = await ElementDrivesTextAnnotation.evaluateFieldsAsync({
  iModel,
  block,
  formatting: {
    formatsProvider: myFormattingSpecProvider, // e.g. Drawing Production's FormatSet-backed provider
    // unitsProvider omitted -> defaults to the iModel's schema-backed units provider
  },
});
```

Applications integrating their own [FormattingSpecProvider]($core-quantity) can discover the [FormatterSpec]($core-quantity)s a [TextBlock]($common) will need before evaluating it, and pre-build them, via the new [ElementDrivesTextAnnotation.collectFieldFormattingRequirements]($backend) entry point:

```typescript
const requirements = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block });
// requirements: FormattingSpecArgs[] with { name, persistenceUnitName } for every quantity/coordinate FieldRun
// whose target property carries a KindOfQuantity (or whose formatOptions override supplies one). Fields with an
// inline `format` override are omitted because they do not require a provider lookup.
await myFormattingSpecProvider.prepare(requirements);
```

Because the transactional callback path that keeps field caches in sync when source elements change is synchronous, applications with a pre-populated [FormattingSpecProvider]($core-quantity) can register it against an [IModelDb]($backend) so that both [ElementDrivesTextAnnotation.evaluateFields]($backend) and txn-driven updates route through it:

```typescript
// Once, after `myFormattingSpecProvider.prepare(...)` has finished (see above):
ElementDrivesTextAnnotation.registerFieldFormattingProvider(iModel, { provider: myFormattingSpecProvider });

// Later, any commit that dirties a source element for a FieldRun will re-format its cached content
// through the registered provider automatically -- no application code required.
// Call `unregisterFieldFormattingProvider` to remove the registration:
ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel);
```

You can register different providers per FormatSet by supplying an `Id64String` `formatSet` id at registration time, and pointing a FieldRun at that FormatSet via [QuantityFieldFormatOptions.formatSet]($common). At evaluation time, each FieldRun is routed by cascading lookup: its `formatSet`-specific registration first, then the iModel-level default registration (registered with no `formatSet`), then the raw string fallback.

```typescript
ElementDrivesTextAnnotation.registerFieldFormattingProvider(iModel, { provider: defaultProvider });
ElementDrivesTextAnnotation.registerFieldFormattingProvider(iModel, { formatSet: mySheetFormatSetId, provider: sheetProvider });

const fieldRun = FieldRun.create({
  propertyHost, propertyPath,
  formatOptions: { quantity: { formatSet: mySheetFormatSetId } },
});
```

If no registration matches (or the resolved provider does not supply a spec for a given field), fields fall back to their existing raw string formatting. To make missing specs surface as an error instead, pass `onMissingSpec: "throw"` when registering the provider (or via [[FieldFormattingProviders]] on the async path):

```typescript
ElementDrivesTextAnnotation.registerFieldFormattingProvider(iModel, { provider: myFormattingSpecProvider, onMissingSpec: "throw" });
// Any FieldRun evaluated against `iModel` whose KindOfQuantity / persistence unit combination
// has not been prepared on `myFormattingSpecProvider` will now throw from evaluateFields and from
// the TxnManager field-update callback path, instead of silently reverting to the raw value.

await ElementDrivesTextAnnotation.evaluateFieldsAsync({
  iModel,
  block,
  formatting: {
    formatsProvider: myFormatsProvider,
    onMissingSpec: "throw",
  },
});
```

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
