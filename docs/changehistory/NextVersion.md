---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Backend-to-frontend IPC invoke](#backend-to-frontend-ipc-invoke)

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
