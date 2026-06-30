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

The new `@alpha` APIs are:

- `IpcHost.invoke` and `IpcHost.makeIpcProxy` on the backend to call frontend handlers.
- `IpcApp.handle` and a new `IpcHandler` base class on the frontend to implement them.
- `IpcHost.invokeTimeout` to optionally bound how long an invocation waits for a response.
- [FrontendError]($common) to represent a `BentleyError` thrown by a frontend handler, surfaced to the backend caller.

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

Because Electron provides no native main-to-renderer `invoke` (only one-way `webContents.send`), this is implemented on top of the existing `send`/`addListener` primitives, so it works across all transports (Electron, mobile, and web sockets).

Pending invocations are rejected if [IpcHost.shutdown]($backend) is called before a response arrives, so promises never leak past shutdown. You can also set the optional `IpcHost.invokeTimeout` (milliseconds) to reject calls whose frontend handler never responds; it is unset by default, meaning calls wait indefinitely.

Mirroring the existing frontend-to-backend direction (where a backend `BentleyError` surfaces to the frontend caller as a [BackendError]($common)), a `BentleyError` thrown by a frontend handler surfaces to the backend caller as the new `@alpha` [FrontendError]($common), preserving the error number, name, message, and logging metadata. A non-`BentleyError` (e.g. a plain `Error`) is re-thrown to the caller as a plain `Error` with its message and any own-enumerable properties preserved.
