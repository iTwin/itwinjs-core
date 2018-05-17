# RpcInterface

An `RpcInterface` is a set of operations exposed by a server that a client can call, using configurable protocols, in a platform-independent way.

This article uses the terms *client* and *server* to identify the two roles in an `RpcInterface`:

* *client* -- the code that uses an RpcInterface and calls its methods. A client could be the frontend of an app, the backend of an app, a service, or an agent. It could be [frontend code](./Glossary.md#frontend) or [backend code](./Glossary.md#backend).
* *server* -- the code that implements and exposes an RpcInterface to clients. A server could be a deployed, stand-alone service, or the backend of an app. It is always [backend code](./Glossary.md#backend).

See [the RpcInterface overview](../overview/RpcInterface.md) for more information on the purpose of RpcInterfaces in the context of overall [app architecture](../overview/SoftwareArchitecture.md).

An RpcInterface is defined and implemented in TypeScript. Conceptually, the interface has three parts:

* The [definition](#defining-the-interface) - The TypeScript method declarations that represent the operations, along with the types of their arguments.
* The [client stub](#client-stub) - The client-side implementation that forwards requests to the server and passes back the results.
* The [impl](#server-implementation) - The server-side implementation that performs the operations and returns the results.

In practice, two TypeScript classes are needed, as explained below.

Communication between a client and the server is via [RPC](./Glossary.md#RPC). The RPC mechanism is factored out into RpcConfiguration which are applied to RpcInterfaces. This design allows clients and servers to be written in a way that is independent of transport details, while allowing transport to be configured at runtime to suit app requirements. See [server-side configuration](#server-side-configuration) and [client-side configuration](#client-side-configuration) below for details.

RpcInterface methods are always [asynchronous](#asynchronous-nature-of-rpcInterfaces).

## Parameter and Return Types

RpcInterface methods can take and return just about any type. Most JavaScript primitive types are supported, such as number, string, bool, and any.

RpcInterfaces can also use TypeScript/JavaScript classes as parameter and return types. The [interface definition](#defining-the-interface) just has to declare the classes that it uses, so that the configurations can marshall them correctly. That is the purpose of the `types` property.

RpcInterfaces are restricted to using types that are common to both frontends and backends. For example, the [IModelToken]($common) type must be used to specify an iModel. The client that makes a call on the interface must obtain the token from the IModelConnection or IModelDb that it has, and the server that implements the interface must translate the token into an IModelDb when it handles the call.

## Defining the Interface

To define an interface, write a TypeScript class that extends [RpcInterface]($common).

The interface definition class should define a method for each operation that is to be exposed by the server. Each method signature should include the names and types of the input parameters. Each method must return a `Promise` of the appropriate type. These methods and their signatures define the interface.

The definition class must also define two static properties as interface metadata:
* `types`. Specifies any non-primitive types used in the methods of interface.
* `version`. The interface version number.

The definition class must be in a directory or package that is accessible to both frontend and backend code. Note that the RpcInterface base class is defined in `@bentley/imodeljs-common`.

A best practice is that an interface definition class should be marked as `abstract`. That tells the developer of the client that the definition class is never instantiated or used directly. Instead, callers use the [client stub](#client-stub) for the interface when making calls.

*Example:*

```ts
[[include:RpcInterface.definition]]
```

In a real interface definition class, each method and parameter should be commented, in order to provide documentation to client app developers that will try to use the interface.

## Client Stub

The client stub is an implementation of the interface that forwards method calls to the RPC mechanism. Each method in the client stub is exactly the same single line of code: `return this.forward.apply(this, arguments);` The forward property is implemented by the base class, and its forward method sends the call and its arguments through the configured RPC mechanism to the server. As shown in the previous example, the client stub code is incorporated into the interface definition class.


## Server Implementation

The server-side implementation is also known as the "impl". An impl is always [backend code](./Glossary.md#backend).

To write an impl, write a concrete TypeScript class that extends [RpcInterface]($common) and also implements the interface definition class.

The impl must override each method in the interface definition class. Each override must perform the intended operation.

Each impl method must return the operation's result as a Promise.

As noted above, the methods in the impl may have to transform certain argument types, such as IModelTokens, before they can be used.

A best practice is that an impl should be a thin layer on top of normal classes in the server. Ideally, each method of an impl should be a one-line forwarding call that uses the public backend API of the server. The impl wrapper should be concerned only with transforming types, not with functionality, while backend operation methods should be concerned only with functionality. Backend operation methods should be static, since a server should be stateless. Preferrably, backend operation methods should be [synchronous if possible](#asynchronous-nature-of-rpcInterfaces).

*Example:*

```ts
[[include:RpcInterface.implementation]]
```

Impls must be registered at runtime, as explained next.

## Server-side Configuration

A server must expose the RpcInterfaces that it implements or imports, so that clients can use them.

First, the server must call [RpcManager#registerImpl]($common) to register the impl classes for the interfaces that it implements, if any.

*Example:*

```ts
[[include:RpcInterface.registerImpls]]
```

Next, the server must decide which interfaces it wants to expose. A server can expose multiple interfaces. A server can expose both its own implementations, if any, and imported implementations. The server can decide at run time which interfaces to expose, perhaps based on deployment parameters. A server will often use [FeatureGates]($common) to decide which interfaces to expose.

*Example:*

```ts
[[include:RpcInterface.selectInterfacesToExpose]]
```

Finally, the server must choose the appropriate RPC configuration for the interfaces. The choice of RPC configuration is simple and corresponds to how the server itself is deployed.

*Example:*

```ts
[[include:RpcInterface.configureImpl]]
```

A server configures its RpcInterfaces in its [configuration-specific main](./AppTailoring.md).

## RpcInterface Performance

In some configurations, client and server may be in separate processes. Some configurations marshall calls over the Internet, where both bandwidth and latency can vary widely. Therefore, care must be taken to limit the number and size of round-trips between clients and servers. In other words, an interface's methods must be "chunky" and not "chatty".

## Asynchronous Nature of RpcInterfaces
The interface between a client and a server is intrinsically asynchronous. That is because the client and server are never in the same JavaScript context, as explained in [the app architecture overview](../overview/App.md#interactive-apps). Since a requested operation is carried out in a different thread of execution, it is asynchronous from the client's point of view, and so the client must treat the result as a Promise. As a result, the impl wrapper methods must also return Promises. Nevertheless, the static methods in the backend that actually perform the requested operations should not be async, unless the operation itself requires it. The purpose of a backend is to do the work, not pass the buck. It is the client that must wait, not the server.
