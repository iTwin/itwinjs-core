# Rpc vs. Ipc

In iTwin.js, [RPC](https://en.wikipedia.org/wiki/Remote_procedure_call) (Remote Procedure Call) and [IPC](https://en.wikipedia.org/wiki/Inter-process_communication) (Inter-Process Communication) are both mechanisms to communicate between a [frontend](../learning/Glossary.md#Frontend) process running in a browser and a [backend](../learning/Glossary.md#Backend) process running under Node.js. Each can be used to connect processes that reside the same machine or on different machines connected through a network.

## RPC

RPC (as implemented in iTwin.js) is used in cases where the frontend and the backend are *loosely coupled*. In this mode a single backend may be servicing many frontends, and more than one backend may service requests from the same frontend. This is often the case for web applications, and the reason that much of today's web architecture is designed to be [stateless](https://en.wikipedia.org/wiki/Stateless_protocol).

With RPC, every request from frontend to backend must include authorization credentials, routing information, etc.. This can add some overhead to the communication, but it is also what enables horizontal scalability. So generally for web applications it is a good tradeoff.

The loose coupling presumption of RPC implies a strict adherence to API [semantic version](https://en.wikipedia.org/wiki/Software_versioning) compatibility, since frontend and backend components are deployed and revised independently. RPC initialization always involves validating version compatibility requirements.

Generally (but not always), RPC in iTwin.js is implemented over [HTTP](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol). This implies that RPC communications must always be initiated by the frontend. This is acceptable due to the *stateless* nature of the protocol, because the backend wouldn't have anything to send that could be addressed to a specific frontend.

## IPC

IPC (as implemented in iTwin.js) is used for cases where the fronted and backend are *tightly coupled*. In this mode a single frontend process is paired with a single backend process in a one-to-one relationship via the [IpcSocket]($common) api. In iTwin.js terms, that means that an [IModelApp]($frontend) is paired with an [IModelHost]($backend) (sometimes referred to as a "dedicated" backend), and their lifetimes coincide. Each can assume that the other can hold unambiguous *contextual state* information over the course of a session. For applications that edit iModels, this relationship is extremely helpful.

With IPC, after some initial validation, messages can be sent each way without any contextual overhead, since the connection is direct and unambiguous. This makes IPC slightly more efficient and straightforward to implement.

Generally, IPC in iTwin.js is implemented as a [socket](https://en.wikipedia.org/wiki/Network_socket) - either via [Electron](https://www.electronjs.org/)'s ipc implementation for desktop applications, or through [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) for web or mobile applications. A virtue of IPC is that a backend can initiate sending messages to *its* frontend.

It should be noted that the [IpcSocket]($common) api does *not* require that the frontend and backend processes reside on the same computer, only that their lifetimes are paired. When they are known to *always* be on the same computer, we refer to that as a [native app](./NativeApps.md).
