---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Backend-to-frontend IPC invoke](#backend-to-frontend-ipc-invoke)
  - [Electron 43 support](#electron-43-support)
  - [@itwin/core-backend](#itwincore-backend)
    - [ChangesetReader.setBatchSize](#changesetreadersetbatchsize)

## @itwin/core-backend

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

## Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).

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