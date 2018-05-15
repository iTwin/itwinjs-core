# RpcInterface

An RpcInterface is a set of operations exposed by a service that a client can call, using configurable protocols, in a platform-independent way.

This article uses the terms client and service to identify the two roles in an RpcInterface:
* *client* -- the code that uses an RpcInterface and calls its methods. A client could be the frontend of an app, the backend of an app, a service, or an agent. It could be [frontend code](./Glossary.md#frontend) *or* [backend code](./Glossary.md#backend).
* *service* -- the code that implements and exposes an RpcInterface to clients. A service could be a deployed, stand-alone service, or the backend of an app, or a package that used by backend code. It is always [backend code](./Glossary.md#backend).

See [the RpcInterface overview](../overview/App.md#rpcinterface) for more information on [app architecture](../overview/App.md) and the purpose of RpcInterfaces.

An RpcInterface is made up of three TypeScript classes:
* The [definition](#defining-the-interface) - An abstract TypeScript class containing abstract methods.
* The [client agent](#client-agent-implementation) - A concrete TypeScript class for clients to use. This class implements each method in the interface as an RPC.
* The [service-side implementation](#service-implementation) - A concrete TypeScript class that implements each method to handle the corrsponding request.

All three classes extend [RpcInterface]($common). The client agent and service-side implementations also *implement* the interface definition. This is explained in detail below.

The client-service RPC mechanism is implemented in [RpcConfigurations]($common). This allows clients and services to be written in a way that is independent of transport details, while allowing transport to be configured at runtime to suit the requirements of the app's configuration. See [service-side configuration](#service-side-configuration) and [client-side configuration](#client-side-configuration) below for details.

RpcInterface methods are always *asynchronous*. That is because the RpcInterface implementation and the client that calls it are never in the same JavaScript context, as explained in [the app architecture overview](../overview/App.md#interactive-apps).

### Parameter and Return Types

RpcInterface methods can take and return just about any type. Most JavaScript primitive types are supported, such as number, string, bool, and any. A few primitive types cannot be used, including Set and Map.

RpcInterfaces can also use TypeScript/JavaScript classes as parameter and return types. The [interface definition](#defining-the-interface) just has to declare the classes that it uses, so that the configurations can marshall them correctly. That is the purpose of the `types` property.

RpcInterfaces are restricted to using types that are common to both frontends and backends. For example, the [IModelToken]($common) type must be used to specify an iModel. The client that makes a call on the interface must obtain the token from the IModelConnection or IModelDb that it has, and the service that implements the interface must translate the token into an IModelDb when it handles the call.

### Defining the Interface

To define an interface, write an abstract TypeScript class that extends [RpcInterface]($common). This class should declare an abstract method for each operation that is to be exposed by the service. Each method must return a `Promise`.

The definition class must also define two static properties:
* `types`. Specifies any non-primitive types used in the methods of interface.
* `version`. The interface version number.

The definition class must be in a directory or package that is accessible to both frontend and backend code. Note that the RpcInterface base class is defined in `@bentley/imodeljs-common`.

*Example:*
```ts
[[include:RpcInterface.definition]]
```

Definitions are used by both [frontend code](./Glossary.md#frontend) and [backend code](./Glossary.md#backend).

### Client Agent Implementation

The client agent is a TypeScript class that implements the interface, defining each method as an RPC. Usually, all of the methods of a client contain exactly the same single line of code: `return this.forward.apply(this, arguments);` The forward property is implemented by the base class, and its forward method sends the call and its arguments through the configured RPC mechanism to the service. The client agent could be customized in some way if necessary.

*Example:*
```ts
[[include:RpcInterface.client-agent]]
```

A client can be either [frontend code](./Glossary.md#frontend) or [backend code](./Glossary.md#backend).

### Service Implementation

The service-side implementation of an RpcInterface is a TypeScript class that implements the interface and extends [RpcInterface]($common). The service-side implementation is also known as the "impl". An impl is always [backend code](./Glossary.md#backend).

The impl must override each method in the interface by performing the intended operation. Each method must return a Promise.

As noted above, the methods in the impl may have to transform certain argument types, such as IModelTokens, before they can be used.

A best practice is that an impl should be a thin layer on top of normal classes in the service. Ideally, each method of an impl should be a one-line forwarding call. The impl wrapper should be concerned only with transforming types, not with functionality. The normal service class methods should be concerned only with functionality. The service class methods should be static.

*Example:*
```ts
[[include:RpcInterface.implementation]]
```

### Service-side Configuration

A service must expose the RpcInterfaces that it implements or imports, so that clients can use them.

First, the service must call [RpcManager.registerImpl]($common) to register the interfaces that it implements, if any.

Next, the service must use configure the RPC mechanism for each interface that it wants to expose. It must choose the configuration to use, based on how the service itself is configured.

A service can expose multiple interfaces. A service can expose both its own implementations, if any, and imported implementations. The service can decide at run time which interfaces to expose, perhaps based on deployment parameters.

*Example:*
```ts
[[include:RpcInterface.initializeImpl]]
```
This example shows how a service could configure and expose more than one interface, including imported interfaces.
It also shows how to choose the appropriate configuration.
It also shows how a service could use ($common/FeatureGates) to decide which interfaces to expose.

### Serving RpcInterfaces

A service must serve out its interfaces, so that in-coming client requests are forwarded to the implementations.

#### Web Server

When a service is configured as a Web service, it can use any Web server technology you like. A single function call is required to integrate all configured interfaces with the Web server. For example, if you use express, do this:
```ts
const webServer = express();
...
webServer.post("*", async (request, response) => {
  rpcConfiguration.protocol.handleOperationPostRequest(request, response);
});
```

#### Electron Desktop App

When a service is the backend of an Electron desktop app, no additional code is required to serve out its interfaces, beyond calling ElectronRpcManager to configure them.

#### Mobile App

When a service is the backend of a mobile app, <em>TBD...</em.

### Client-side Configuration

A client (e.g., an app frontend) must configure the interfaces that it intends to use. And, it must specify the appropriate configuration for each interface, depending on the configuration of the app itself and relationship between the client and the service.
|Type of service|Type of app|Configuration to use
|---------------|-----------|--------------------
|App-specific backend|Mobile app|[in-process RPC configuration](../overview/App.md#in-process-rpc-configuration).
|"|Desktop app|[desktop RPC configuration](../overview/App.md#desktop-rpc-configuration).
|"|Web app|[cloud PRC configuration](../overview/App.md#cloud-rpc-configuration).
|External service|*|The client will always use the [cloud RPC configuration](../overview/App.md#cloud-rpc-configuration) for services.

*Example:*
```ts
[[include:RpcInterface.initializeClient]]
```

A client makes calls on a interface's client implementation (which just forwards the calls to the service, via the configured RPC mechanism). The call signature for the client methods is the same as given in the definition.

### RpcInterface Performance

In some configurations, client and service may be in separate processes. Some configurations marshall calls over the Internet, where both bandwidth and latency can vary widely. Therefore, care must be taken to limit the number and size of round-trips between clients and services. In other words, an interface's methods must be "chunky" and not "chatty".
