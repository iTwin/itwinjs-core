# RpcInterface

As described in the [software architecture overview](./SoftwareArchitecture.md), the functionality of an iModelJs app is typically implemented in separate components, which run in different threads, processes, and/or machines. These components communicate through interfaces, which are called *RpcInterfaces* because they use remote procedure calls, or [RPC](../learning/Glossary.md#RPC).

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC1.png)

The diagram above shows an app frontend requesting operations from some backend. The frontend in this case is the client and the backend is the server. In general, the terms *client* and *server* specify the two *roles* in an RpcInterface:
* *client* -- the code that uses an RpcInterface and calls its methods. A client could be the [frontend of an app](./App.md#app-frontend), the [backend of an app](./App.md#app-backend), a [service](./App.md#imodel-services), or an [agent](./App.md#imodel-agents). A client could be [frontend code](../learning/Glossary.md#frontend) or [backend code](../learning/Glossary.md#backend).

* *server* -- the code that implements and exposes an RpcInterface to clients. A server could the [backend of an app](./App.md#app-backend) or a [service](./App.md#imodel-services). A server is always [backend code](../learning/Glossary.md#backend).

As shown, client and server work with the *RpcManager* to use an RpcInterface. RpcManager exposes a client "stub" on the client side. This stub forwards the request. On the other end, RpcManager uses a server dispatch mechanism to rely the request to the implementation in the server. In between the two is a transport mechanism that marshalls calls from the client to the server over an appropriate communications channel. The transport mechanism is encapsulated in a *configuration* that is applied at runtime.

A typical app frontend will use more than one remote component. Likewise, a server can contain and expose more than one component. For example, the app frontend might need two interfaces, Interface 1 and Interface 2. In this example, both are implemented in Backend A.

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC2.png)

An app frontend can just as easily work with multiple backends to obtain the services that it needs. One of the configuration parameters for an RpcInterface is the identity of the backend that provides it. For example, suppose that the frontend also needs to use Interface 3, which is is served out by Backend B.

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC3.png)

The RPC transport configuration that the frontend uses for Backend B can be different from the configuration it uses for Backend A. In fact, that is the common case. If Backend A is the app's own backend and Backend B is a remote service, then the app will use an RPC configuration that matches its own configuration for A, while it uses a Web configuration for B.

As noted above, the client of an RPC interface can be frontend or backend code. That means that backends can call on the services of other backends. In other words, a backend can be a server and a client at the same time. A backend configures the RpcInterfaces that it *implements* by calling the initializeImpl method on RpcManager, and it configures the RpcInterfaces that it *consumes* by calling initializeClient. For example, suppose Backend B needs the services of Backend C.

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC4.png)

## RpcInterfaces are TypeScript Classes

An RpcInterface is a normal TypeScript class. A client requests a server operation by calling an ordinary TypeScript method, passing parameters and getting a result as ordinary TypeScript objects. The client gets the TypeScript interface object from the RpcManager. As noted above, the client  does not deal with communication

Likewise, a server implements and expose operations by writing normal TypeScript classes. A server registers its implementation objects with RcpManager. And, RpcManager dispatches in-coming requests from clients to those implementation objects.

See [learning RpcInterfaces](../learning/RpcInterface.md) for information on how to write, use, and expose RpcInterfaces.

## RPC Configuration

The [architecture comparison](./SoftwareArchitecture.md#comparison) diagram shows the role of RpcInterfaces in supporting portable, resuable app components. A different transport mechanism in each configuration. RpcManager is used by clients and servers to [apply configurations to RpcInterfaces](#rpc-configuration).

### Web RPC configuration

The Web RPC configuration transforms client calls on an [RpcInterface](#RpcInterface) into HTTP requests. Provides endpoint-processing and call dispatching in the server process. The iModelJs cloud RPC configuration is highly parameterized and can be adapted for use in many environments. This configuration is designed to cooperate with routing and authentication infrastructure. See [Web architecture](./SoftwareArchitecture.md#web).

iModelJs comes with an implementation of a Web RPC configuration that works with the Bentley Cloud infrastructure. It is relatively straightforward for developers to write custom Web RPC configurations that works with other infrastructures.

### Desktop RPC configuration

The iModelJs desktop RPC configuration is specific to the Electron framework. It marshalls calls on an [RpcInterface](#RpcInterface) through high-bandwidth, low-latency pipes between cooperating processes on the same computer. It provides endpoint-processing and call dispatching in thebackend process. See [Desktop architecture](./SoftwareArchitecture.md#desktop).

### In-process RPC configuration

The in-process RPC configuration marshalls calls on an [RpcInterface](#RpcInterface) across threads within a single process. It also provides call dispatching in the backend thread. See [Mobile architecture](./SoftwareArchitecture.md#mobile).

## RpcInterface Performance

Apps must be designed with remote communication in mind. In the case where a server or app backend is accessed over the Internet, both bandwidth and latency can vary widely. Therefore, care must be taken to limit number and size of round-trips between clients and servers. RpcInterface methods must be "chunky" and not "chatty".

## Logging and ActivityIds

A request may pass through many communication tiers. A request will generally be carried out by backends running on other machines. Finally, the backends that carry out a request may run asynchronously. Yet, all of those steps make up a single "activity". To make it possible to understand and troubleshoot such distributed and asynchronous activities, RpcInterface associates a unique "ActivityId" with every client request that goes out over the wire. The ActivityId that was assigned the original request then appears in logging messages emitted by downstream communications and backend methods that handle the request. That allows a log browser to correlate all of the operations with the original request, no matter where or when they were carried out.

Frontend methods may also optionally log additional messages that are tagged with the same ActivityId, to provide useful information about the purpose of the activity.

Frontend methods that invoke imodeljs-clients methods directly are responsible for generating or forwarding an ActivityId to them.

A backend method that turns around an invokes another backend's method via RpcInterfaces will propagate the current ActivityId to it.

Briefly, here is how it works:
* Frontend/client
  * iModelJs on the frontend assigns a unique ActivityId value to an RpcIntereface call.
  * It puts this value in the [X-Correlation-ID](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields) HTTP header field, to ensure that it stays with the request as it passes through communication layers.
* Backend
  * iModelJs on the backend gets the ActivityId from the HTTP header.
  * RpcInvocation passes the ActivityId to RpcInterface implementation methods.
  * RpcInvocation and all the async methods in the backend work together to make the ActivityId part of the context in which backend methods are called.
  * Calls to the Logging manager also occur in this context, and so the Logging manager gets the ActivityId from the context and adds to the logging messages as metadata using a Bentley-standard "ActivityId" property id.
* Log Browsers
  * Can filter on the Bentley-standard "ActivityId" property to correlate all messages related to the same request.

See [managing the ActivityLoggingContext](../learning/backend/ManagingActivityLoggingContext.md) for details.