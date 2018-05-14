# RpcInterface

An RpcInterface is a set of operations exposed by a service that a client can call, using configurable protocols, in a platform-independent way.

An RpcInterface is made up of three classes:
* An abstract TypeScript class that *defines* the interface as a set of abstract methods.
* A concrete TypeScript class for clients to use. This class implements the interface, making each method an RPC.
* A concrete TypeScript class that the service implements. This class extends implements the interface, making each method actually handle the corrsponding request.

None of the classes that make up an RpcInterface contains any code that deals directly with communications. Instead, *RpcConfigurations* control how calls on an RpcInterface are marshalled. The key concept is that the interface and call marshalling are distinct concepts. Marshalling is factored out, so that clients and services can be written in a way that is independent of transport details, while transport can be configured at runtime to suit the requirements of the app's configuration.

In this article, the term *client* is used to denote the code that uses an RpcInterface can calls its methods. A client could be the frontend of an app, the backend of an app, a service, or an agent. The term *service* is used to denote the code that implements and exposes an RpcInterface to clients. A service could be a deployed, stand-alone service, or the backend of an app, or a package that used by backend code. The main point is that it is [backend code](./Glossary.md#backend).

RpcInterface methods are always *asynchronous*. That is because the RpcInterface implementation and the client that calls it are never in the same JavaScript context. This follows from the [iModelJs app architecture](../overview/App.md#interactive-apps).

For more information on the purpose of RpcInterfaces and their role in app architecture, see [RpcInterface](../overview/App.md#rpcinterface).

### Defining the Interface

An RpcInterface *definition* is an abstract TypeScript class that extends [RpcInterface]($common).

The definition class must define an abstract method for each operation that is to be exposed by the service.

Each method must return a `Promise`.

The definition class must also define:
* `public static types`. This declares what classes are used in the methods in the RpcInterface,
 so that the chosen configuration can marshall them correctly. RpcInterface methods are not restricted to primitive types.
* `public static version`. The interface version number.

RpcInterface definition classes must be in a directory or package that is accessible to both frontend and backend code. Note that the RpcInterface base class is defined in `@bentley/imodeljs-common`.

*Example:*
```ts
[[include:RpcInterface.definition]]
```

### Client Implementation

The client-side implementation class of an RpcInterface must implement the interface defining each method as an RPC. In practice, this means implementing each method with the same generic code: `return this.forward.apply(this, arguments);`

### Service Implementation

The service-side implementation of an RpcInterface is a TypeScript class that implements the interface and extends [RpcInterface]($common).

The implementation class must override each interface method by performing the operations. Each method must be asynchronous. The impl will also have to transform certain arguments, such as IModelTokens, before they can be used.

A best practice is that the RpcInterface implementation should simply forward the calls, so that each method is a one-liner. The called methods that peform the real operations should be in the service class, not in the RpcInterface impl, and should be completely free of RpcInterface-specific details, such as the artificial types used in marshalling.

A RpcInterface impl class is always defined in backend code and is not exposed directly to clients.

*Example:*
```ts
[[include:RpcInterface.implementation]]
```

### Configuration (Service Side)

A service must expose the RpcInterfaces that it implements or imports, so that clients can use them.

First, the service must call [RpcManager.registerImpl]($common) to register the interfaces that it implements, if any.

Next, the service must use configure the RPC mechanism for each interface that it wants to expose. It must choose the configuration to use, based on how the service itself is configured.

A service can expose multiple interfaces. A service can expose both its own implementations, if any, and imported implementations. The service can decide at run time which interfaces to expose, perhaps based on deployment parameters.

*Example:*
```ts
[[include:RpcInterface.configure]]
```
This example shows how a service could configure and expose more than one interface, including imported interfaces.
It also shows how to choose the appropriate configuration.
It also shows how a service could use ($common/FeatureGates) to decide which interfaces to expose.

### Serving RpcInterfaces (Service Side)

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

### Configuring and Calling RpcInterfaces (Client side)

A client (e.g., an app frontend) must configure the interfaces that it intends to use.
It must use the appropriate configuration for each interface, depending on how the client itself it configured and how the service that implements the interface is deployed.

A client makes calls on a interface's client implementation. Each method in the client implementation forwards the call to the service, via the configured RPC mechanism. The call signature for the client methods is the same as given in the definition.

### RpcInterface Performance

In some configurations, client and service may be in separate processes. Some configurations marshall calls over the Internet, where both bandwidth and latency can vary widely. Therefore, care must be taken to limit the number and size of round-trips between clients and services. In other words, an interface's methods must be "chunky" and not "chatty".
