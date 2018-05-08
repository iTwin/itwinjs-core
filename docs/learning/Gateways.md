# Gateways

A gateway is a set of operations exposed by a service that a client can call, using configurable protocols, in a platform-independent way.

A gateway consists of:
* A TypeScript class that *defines* the gateway.
* The proxy class for clients to use.
* A TypeScript class that implements the gateway in [backend code](./Glossary.md#backend).
* Configurations that specify how calls on the gateway are to be marshalled.

The key concept is that API definition, API implementation, and call marshalling are all distinct concepts. Marshalling is factored out, so that clients and services can be written in a way that is independent of transport details, while transport can be configured at runtime to suit the requirements of the app's configuration.

In this article, the term *client* is used to denote the code that calls gateway methods. A client could be the frontend of an app, the backend of an app, a service, or an agent. The term *service* is used to denote the code that implements and exposes a gateway to clients. A service could be a deployed, stand-alone service, or the backend of an app, or a package that used by backend code. The main point is that it is [backend code](./Glossary.md#backend).

Gateway methods are always asynchronous. That is because the gateway implementation and the client that calls it are never in the same JavaScript context. This follows from the [iModelJs app architecture](../overview/App.md#interactive-apps).

For more information on the purpose of gateways and their role in app architecture, see [Gateways](../overview/App.md#gateways).

### Defining Gateways

A gateway *definition* is an abstract TypeScript class that extends ($common/Gateway).

The definition class must define a static, asynchronous method for each operation that is to be exposed by the service. That defines the gateway API. Each API method in the definition class does double duty: it both declares an operation and it contains the implementation of the client-side proxy. In practice, all proxy implementations are the same generic one-liner.

A gateway definition class must also define:
* `public static types`. This declares what classes are used in the methods in the gateway API,
 so that the gateway system can prepare to marshall them correctly. Gateway methods are not restricted to primitive types.
* ? version ?

Gateway definition classes must be in a directory or package that is accessible to both frontend and backend code. Note that the Gateway base class is defined in `@bentley/imodeljs-common`.

*Example:*
```ts
[[include:Gateway.definition]]
```

### Implementing Gateways

A gateway *implementation* is a TypeScript class that implements a particular gateway definition and extends ($common/Gateway).

The implementation class must override each API method defined by the gateway definition, that is, it must actually implement the operations. A best practice is that a gateway implementation should simply forward the calls, so that each method is a one-liner. The called methods should be in the service class, not in the gateway, and should be completely free of gateway details.

A gateway definition class is always defined in backend code and is not exposed directly to clients.

*Example:*
```ts
[[include:Gateway.implementation]]
```

### Configuring Gateways (Service side)

A service must expose the gateways that it implements or imports, so that clients can use them.

First, the service must call ($common/Gateway.registerImplementation) to register the gateways that it implements, if any.

Next, the service must use a ($common/GatewayConfiguration) to configure the gateways that it wants to expose. It must choose the gateway configuration to use, based on how the service itself is configured. Choices include ....

A service can expose multiple gateways. A service can expose both its own implementations, if any, and imported implementations. The service can decide at run time which gateways to expose, perhaps based on deployment parameters.

*Example:*
```ts
[[include:Gateway.configure]]
```
This example shows how a service could configure and expose more than one gateway, including imported gateways.
It also shows how to choose the appropriate configuration.
It also shows how a service could use ($common/FeatureGates) to decide which gateways to expose.

### Serving Gateways (Service side)

A service must serve out its gateways, so that in-coming client calls/requests on the gateway are forwarded to the gateway implementations.

#### Web Server

When a service is configured as a Web service, it can use any Web server technology you like. A single function call is required to integrate all configured Gateways with the Web server. For example, if you use express, do this:
```ts
const app = express();
...
app.post("*", async (req, res) => gatewaysConfig.protocol.handleOperationPostRequest(req, res));
```

#### Electron Desktop App

When a service is the backend of an Electron desktop app, no additional code is required to serve out gateways, beyond calling GatewayElectronConfiguration to configure them.

#### Mobile App

When a service is the backend of a mobile app, <em>TBD...</em.

### Configuring and Calling Gateways (Client side)

A client (e.g., an app frontend) must configure the gateways that it intends to use.
It must use the appropriate ($common/GatewayConfiguration) for each gateway, depending on how the client itself it configured and how the service that implements the gateway is deployed.
... TBD more details on this ...
... TBD code sample ...

A client makes calls on a gateway's [proxy]($common/Gateway.getProxyForGateway). Each method in the proxy forwards the call to the implementation. The call signature for the proxy methods is the same as given in the definition.

### Gateway Performance

In some configurations, client and service may be in separate processes. Some configurations marshall calls over the Internet, where both bandwidth and latency can vary widely. Therefore, care must be taken to limit the number and size of round-trips between clients and services. In other words, a gateway's methods must be "chunky" and not "chatty".
