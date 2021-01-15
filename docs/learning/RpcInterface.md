# RpcInterface

This article discusses RPC communication in iModel.js. See also [RPC vs IPC](./RpcVsIpc.md).

Table of Contents:

* [Overview](#overview)
* Implementing RpcInterfaces
  * [RpcInterfaces are Typescript Classes](#rpcinterfaces-are-typescript-classes)
  * [RpcInterface Performance](#rpcinterface-performance)
  * [Define the Interface](#define-the-interface)
  * [Client Stub](#client-stub)
  * [Server Implementation](#server-implementation)
* Configuring RpcInterfaces
  * [Server-side Configuration](#server-side-configuration)
  * [Client-side Configuration](#client-side-configuration)
* [Serve the Interfaces](#serve-the-interfaces)
* [Asynchronous Nature of RpcInterfaces](#asynchronous-nature-of-rpcinterfaces)
* [Logging and ActivityIds](#logging-and-activityids)

## Overview

As described in the [software architecture overview](./SoftwareArchitecture.md), the functionality of an iModel.js app is typically implemented in separate components that run in different processes, potentially on different machines. These components communicate through interfaces. These interfaces can either be implemented as [Rpc or Ipc](./RpcVsIpc.md). For web applications, iModel.js uses *RpcInterfaces* or [RPC](../learning/Glossary.md#RPC).

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC1.png)

The diagram above shows an app frontend requesting operations from some backend. The terms *client* and *server* specify the two *roles* of an RpcInterface:

* *client* -- the code that runs on the frontend, and calls methods on an RpcInterface.

* *server* -- the code that runs on the backend, and implements the RpcInterface.

Classes that derive from [RpcInterface]($common) define a set of operations implemented by a server, callable from a client.

As shown, client and server work with the [RpcManager]($common) to manage the available RpcInterfaces. RpcManager exposes a client "stub" on the client side that forwards RPC requests. On the other end, RpcManager uses a server dispatch mechanism to relay the request to the implementation in the server. In between the two is a transport mechanism that marshalls the data passed from the client to the serverover an appropriate communications channel. The transport mechanism is encapsulated in a *configuration* that is applied at runtime.

A typical app frontend will use more than one remote component. Likewise, a server can contain and expose more than one component. For example, the app frontend might need two interfaces, Interface 1 and Interface 2. In this example, both are implemented in Backend A.

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC2.png)

An app frontend can just as easily work with multiple backends to obtain the services that it needs. One of the configuration parameters for an RpcInterface is the identity of the backend that provides it. For example, suppose that the frontend also needs to use Interface 3, which is served out by Backend B.

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC3.png)

The RPC transport configuration that the frontend uses for Backend B can be different from the configuration it uses for Backend A. In fact, that is the common case. If Backend A is the app's own backend and Backend B is a remote service, then the app will use an [RPC configuration](#rpc-configuration) that matches its own configuration for A, while it uses a Web configuration for B.

As noted above, the client of an RPC interface can be frontend or backend code. That means that backends can call on the services of other backends. In other words, a backend can be a server and a client at the same time. A backend configures the RpcInterfaces that it *implements* by calling the initializeImpl method on RpcManager, and it configures the RpcInterfaces that it *consumes* by calling initializeClient. For example, suppose Backend B needs the services of Backend C.

![SoftwareArchitecture-Rpc](./SoftwareArchitecture-RPC4.png)

## Implementing an RpcInterface

### RpcInterfaces are TypeScript Classes

An RpcInterface is a normal TypeScript class. A client requests a server operation by calling an ordinary TypeScript method, passing parameters and getting a result as ordinary TypeScript objects. The client gets the TypeScript interface object from the RpcManager. As noted above, the client  does not deal with communication

Likewise, a server implements and exposes operations by writing normal TypeScript classes. A server registers its implementation objects with RcpManager. And, RpcManager dispatches in-coming requests from clients to those implementation objects.

### Parameter and Return Types

RpcInterface methods can take and return only primitive types and objects that are composed of primitive types or other such objects.

### RpcInterface Performance

Apps must be designed with remote communication in mind. In the case where a server or app backend is accessed over the Internet, both bandwidth and latency can vary widely. Therefore, care must be taken to limit number and size of round-trips between clients and servers. RpcInterface methods must be "chunky" and not "chatty".

Also see [best practices](./backend/BestPractices.md).

### Define the Interface

To define an interface, write a TypeScript class that extends [RpcInterface]($common).

The interface definition class must define a method for each operation that is to be exposed by the server. Each method signature must include the names and types of the input parameters. Each method must return a `Promise` of the appropriate type. These methods and their signatures define the interface.

The definition class must also define two static properties as interface metadata:

```ts
public static readonly interfaceName = "theNameOfThisInterface"; // The immutable name of the interface
public static interfaceVersion = "1.2.3"; // The API version of the interface
```

The `interfaceName` property specifies the immutable name of the interface. This string, rather than Javascript class name, is used to identify the interface when a request is sent from a frontend to a backend. That makes it safe to apply a tool such as Webpack to the frontend code, which may change the names of Javascript classes.

See [below](#rpcinterface-versioning) for more on interface versioning.

The definition class must be in a directory or package that is accessible to both frontend and backend code. Note that the RpcInterface base class is defined in `@bentley/imodeljs-common`.

A best practice is that an interface definition class should be marked as `abstract`. That tells the developer of the client that the definition class is never instantiated or used directly. Instead, callers use the [client stub](#client-stub) for the interface when making calls.

*Example:*

```ts
[[include:RpcInterface.definition]]
```

In a real interface definition class, each method and parameter should be commented, to provide documentation to client app developers that will try to use the interface.

### Client Stub

The client stub is an implementation of the interface that forwards method calls to the RPC mechanism. Each method in the client stub is exactly the same single line of code:

```ts
return this.forward(arguments);
```

The forward property is implemented by the base class, and its forward method sends the call and its arguments through the configured RPC mechanism to the server. As shown in the previous example, the client stub code is incorporated into the interface definition class.

### Server Implementation

The server-side implementation is also known as the "impl". An impl is always [backend code](./Glossary.md#backend).

To write an impl, write a concrete TypeScript class that extends [RpcInterface]($common) and also implements the interface definition class.

The impl must override each method in the interface definition class. Each override must perform the intended operation.

Each impl method must return the operation's result as a Promise.

The impl method must obtain the ClientRequestContext by calling [ClientRequestContext.current]($bentley). It must then follow the [rules of managing the ClientRequestContext](./backend/ManagingClientRequestContext.md).

The methods in the impl may have to transform certain argument types, such as IModelRpcProps, before they can be used by backend code.

A best practice is that an impl should be a thin layer on top of normal classes in the server. The impl wrapper should be concerned only with transforming types, not with functionality, while backend operation methods should be concerned only with functionality. Backend operation methods should be static, since a server should be stateless. Preferably, backend operation methods should be [synchronous if possible](#asynchronous-nature-of-rpcinterfaces).

*Example:*

```ts
[[include:RpcInterface.implementation]]
```

Impls must be registered at runtime, as explained next.

### RPC Configuration

The [architecture comparison](./SoftwareArchitecture.md#comparison) diagram shows the role of RpcInterfaces in supporting portable, reusable app components. A different *transport mechanism* is used in each configuration. RpcManager is used by clients and servers to apply configurations to RpcInterfaces.

### Web RPC configuration

The Web RPC configuration transforms client calls on an RpcInterface into HTTP requests. Provides endpoint-processing and call dispatching in the server process. The iModel.js cloud RPC configuration is highly parameterized and can be adapted for use in many environments. This configuration is designed to cooperate with routing and authentication infrastructure. See [Web architecture](./SoftwareArchitecture.md#web).

iModel.js comes with an implementation of a Web RPC configuration that works with the Bentley Cloud infrastructure. It is relatively straightforward for developers to write custom Web RPC configurations that works with other infrastructures.

### Desktop RPC configuration

The iModel.js desktop RPC configuration is specific to the Electron framework. It marshalls calls on an RpcInterface through high-bandwidth, low-latency pipes between cooperating processes on the same computer. It provides endpoint-processing and call dispatching in the backend process. See [Desktop architecture](./SoftwareArchitecture.md#desktop).

### In-process RPC configuration

The in-process RPC configuration marshalls calls on an RpcInterface across threads within a single process. It also provides call dispatching in the backend thread. See [Mobile architecture](./SoftwareArchitecture.md#mobile).

## Server-side Configuration

A server must expose the RpcInterfaces that it implements or imports, so that clients can use them. To do that, the server must: register its impls, choose the interfaces that it wants to expose, configure those interfaces, and finally serve those interfaces.

### Register Impls

The server must call [RpcManager.registerImpl]($common) to register the impl classes for the interfaces that it implements, if any.

*Example:*

```ts
[[include:RpcInterface.registerImpls]]
```

### Choose Interfaces

The server must decide which interfaces it wants to expose. A server can expose multiple interfaces. A server can expose both its own implementations, if any, and imported implementations. The server can decide at run time which interfaces to expose, perhaps based on deployment parameters.

*Example:*

```ts
[[include:RpcInterface.selectInterfacesToExpose]]
```

## Configure Interfaces

The server must choose the appropriate RPC configuration for the interfaces that it exposes to clients.
If the server is an app backend, the RPC configuration must correspond to the app configuration.
If the server is a [service](./App.md#imodel-services), it must always use a [Web RPC configuration](#web-rpc-configuration) for its interfaces.
A backend should configure its RpcInterfaces in its [configuration-specific main](./AppTailoring.md#configuration-specific-main).

*Electron Example:*

``` ts
[[include:RpcInterface.initializeBackendForElectron]]
```

*Web Example:*

``` ts
[[include:RpcInterface.initializeForCloud]]
```

### Serve the Interfaces

When a backend is configured as a Web app, it must implement a Web server to serve out its interfaces, so that in-coming client requests are forwarded to the implementations. This is always true of all [services](./App.md#imodel-services). Any Web server technology can be used. Normally, a single function call is all that is required to integrate all configured interfaces with the Web server. For example, if a Web server uses express, it would serve its RpcInterfaces like this:

```ts
const webServer = express();
...
webServer.post("*", async (request, response) => {
  rpcConfiguration.protocol.handleOperationPostRequest(request, response);
});
```

It is this simple because the server should be concerned *only* with serving its RpcInterfaces and not with static resources or any other kind of API.

### Client-side Configuration

The client must specify *what* interfaces it plans to use and *where* those interfaces are found.
The configuration for all app-specific RpcInterfaces must agree with the app's overall configuration.
A frontend should configure its RpcInterfaces in its [configuration-specific main](./AppTailoring.md#configuration-specific-main).

### Desktop Configuration

A desktop app must use a desktop configuration.

*Desktop Example:*

``` ts
[[include:RpcInterface.initializeFrontendForElectron]]
```

### Web Configuration

The configuration of RpcInterfaces in a Web app depends on the relative locations of the frontend and backend(s). There are two basic options:

#### Same Server

If the app has its own backend, and if its backend serves both its RpcInterfaces and its frontend Web resources, then configuration is simple. Just pass the array of interfaces to [BentleyCloudRpcManager]($common). The URI of the backend defaults to the origin of the Web page.

*Web example (simple app):*

``` ts
[[include:RpcInterface.initializeClientBentleyCloudApp]]
```

#### Different Servers

If the origin of the frontend is different from the server that runs the backend that provides a given set of RpcInterfaces, then the frontend must specify the URI of the backend server in the `uriPrefix` property when configuring BentleyCloudRpcManager.

*Web example (separate backend):*

``` ts
[[include:RpcInterface.initializeClientBentleyCloudRemote]]
```

A single frontend can consume RpcInterfaces from multiple sources, including the app's own backend, if any, and remote services. The frontend must group interfaces according to the backend that provides them and then use the appropriate configuration for each.

## Asynchronous Nature of RpcInterfaces

The interface between a client and a server is intrinsically asynchronous. That is because the client and server are never in the same JavaScript context, as explained in [the app architecture overview](./App.md#interactive-apps). Since a requested operation is carried out in a different thread of execution, it is asynchronous from the client's point of view, and so the client must treat the result as a Promise. As a result, the impl wrapper methods must also return Promises. Nevertheless, the static methods in the backend that actually perform the requested operations should not be async, unless the operation itself requires it. The purpose of a backend is to do the work, not pass the buck. It is the client that must wait, not the server.

## Logging and ActivityIds

A request may pass through many communication tiers. A request will generally be carried out by backends running on other machines. Finally, the backends that carry out a request may run asynchronously. Yet, all of those steps make up a single "activity". To make it possible to understand and troubleshoot such distributed and asynchronous activities, RpcInterface associates a unique "ActivityId" with every client request that goes out over the wire. The ActivityId that was assigned to the original request then appears in logging messages emitted by downstream communications and backend methods that handle the request. That allows a log browser to correlate all of the operations with the original request, no matter where or when they were carried out.

Frontend methods may also optionally log additional messages that are tagged with the same ActivityId, to provide useful information about the purpose of the activity.

Frontend methods that invoke client methods directly are responsible for generating or forwarding an ActivityId to them.

A backend method that turns around an invokes another backend's method via RpcInterfaces will propagate the current ActivityId to it.

Briefly, here is how it works:

* Frontend/client
  * iModel.js on the frontend assigns a unique ActivityId value to an RpcInterface call.
  * It puts this value in the [X-Correlation-ID](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields) HTTP header field, to ensure that it stays with the request as it passes through communication layers.
* Backend
  * iModel.js on the backend gets the ActivityId from the HTTP header.
  * The RpcInterface mechanism and all the async methods in the backend work together to make the ActivityId part of the context in which backend methods are called.
  * Calls to the Logging manager also occur in this context, and so the Logging manager gets the ActivityId from the context and adds to the logging messages as metadata using a Bentley-standard "ActivityId" property id.
* Log Browsers
  * Can filter on the Bentley-standard "ActivityId" property to correlate all messages related to the same request.

See [managing the ClientRequestContext](../learning/backend/ManagingClientRequestContext.md) for details.

## RpcInterface Versioning

Each RpcInterface has a version. This should not to be confused with the version of the package that implements the interface. The version of an RpcInterface refers to the shape of the interface itself.

You should change the version of an RpcInterface if you change its shape.
Follow the rules of [semantic versioning](https://semver.org) to indicate the type of change made to the RpcInterface.

## Non-Zero Major Versions (released)

* Change in major version indicates a breaking change
* Change in minor version indicates a method was added
* Change in patch indicates a fix not affecting compatibility was made

## Zero Major Versions (prerelease)

* Major version locked at zero
* Change in minor version indicates a potentially breaking change
* Change in patch indicates that a method was added or a fix was made

Interface version incompatibility is a possibility when a client makes requests on a remote server. The [RpcManager]($common) checks that the RcpInterface requested by the client is fulfilled by the implementation provided by the server. An interface is not fulfilled if it is missing or is incompatible. If the interface is missing, then the client's method call will throw an error. If the versions are incompatible, then the client's method call will throw an [IModelError]($common) with an errorNumber of [RpcInterfaceStatus.IncompatibleVersion]($bentley).

The rules of [semantic versioning](https://semver.org) define compatibility. In brief, an interface is incompatible if:
There are different types of incompatibilities:

* Complete mismatch
  * Different major versions
  * Different minor versions in prerelease when major version is zero
* Client too new
  * Client version has the same major version but is greater than the server's version when considering minor and patch
