/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export * from "./Code";
export * from "./ColorDef";
export * from "./ECSqlTypes";
export * from "./ElementProps";
export * from "./EntityProps";
export * from "./FeatureGates";
export * from "./FeatureIndex";
export * from "./Frustum";
export * from "./Fonts";
export * from "./Gateway";
export * from "./IModel";
export * from "./IModelError";
export * from "./IModelVersion";
export * from "./Lighting";
export * from "./ModelProps";
export * from "./OctEncodedNormal";
export * from "./QPoint";
export * from "./SubCategoryAppearance";
export * from "./ViewProps";
export * from "./Render";
export * from "./Utility";
export * from "./geometry/AreaPattern";
export * from "./geometry/Cartographic";
export * from "./geometry/GeometryStream";
export * from "./geometry/LineStyle";
export * from "./geometry/Primitives";
export * from "./geometry/TextString";
export * from "./gateway/core/GatewayConfiguration";
export * from "./gateway/core/GatewayInvocation";
export * from "./gateway/core/GatewayOperation";
export * from "./gateway/core/GatewayProtocol";
export * from "./gateway/core/GatewayRequest";
export * from "./gateway/core/GatewayControl";
export * from "./gateway/electron/GatewayElectronConfiguration";
export * from "./gateway/http/BentleyCloudGatewayConfiguration";
export * from "./gateway/IModelReadGateway";
export * from "./gateway/IModelWriteGateway";
export * from "./gateway/StandaloneIModelGateway";

/** @docs-package-description
 * The imodeljs-common package contains classes for working with iModels in both frontend and backend.
 */

/**
 * @docs-group-description App
 * Classes for defining an app.
 * For more information, see [App Overview]($docs/overview/overview/App.md).
 */
/**
 * @docs-group-description BisCore
 * Classes for working with the major classes in the BisCore schema.
 * For more information, see [BIS Overview]($docs/overview/overview/BIS.md)
 */
 /**
  * @docs-group-description Codes
  * Classes for working with Codes.
  */
/**
 * @docs-group-description ECSQL
 * Classes for working with ECSQL.
 * For more information: [ECSQL]($docs/learning/learning/ECSQL.md)
 */
/**
 * @docs-group-description Errors
 * Classes for working with errors.
 */
/**
 * @docs-group-description FontsAndSymbology
 * Classes for working with fonts, colors, and other symbology.
 */
/**
 * @docs-group-description Gateway
 * A gateway is a set of operations exposed by a service that a client can call, using configurable protocols, in a platform-independent way.
 *
 * A gateway consists of:
 * * A TypeScript class that *defines* the gateway.
 * * The proxy class for clients to use.
 * * A TypeScript class that implements the gateway in [backend code]($docs/overview/overview/Glossary.md#backend).
 * * Configurations that specify how calls on the gateway are to be marshalled.
 *
 * The key concept is that API definition, API implementation, and call marshalling are all distinct concepts. Marshalling is factored out, so
 * that clients and services can be written in a way that is independent of transport details, while transport can be configured at runtime to suit
 * the requirements of the app's configuration.
 *
 * In this article, the term *client* is used to denote the code that calls gateway methods.
 * A client could be the frontend of an app, the backend of an app, a service, or an agent.
 * The term *service* is used to denote the code that implements and exposes a gateway to clients.
 * A service could be a deployed, stand-alone service, or the backend of an app, or a package that used by backend code.
 * The main point is that it is [backend code]($docs/overview/overview/Glossary.md#backend).
 *
 * Gateway methods are always asynchronous. That is because the gateway implementation and the client that calls it are never in the same
 * JavaScript context. This follows from the [iModelJs app architecture]($docs/overview/overview/App.md#interactive-app).
 *
 * For more information on the purpose of gateways and their role in app architecture, see [Gateways]($docs/overview/overview/App.md#gateways).
 *
 * ### Defining Gateways
 *
 * A gateway *definition* is an abstract TypeScript class that extends [Gateway]($imodeljs-common/Gateway).
 *
 * The definition class must define a static, asynchronous method for each operation that is to be exposed by the service.
 * That defines the gateway API.
 * Each API method in the definition class does double duty: it both declares an operation and it contains the implementation of the client-side proxy.
 * In practice, all proxy implementations are the same generic one-liner.
 *
 * A gateway definition class must also define:
 * * `public static types`. This declares what classes are used in the methods in the gateway API,
 * so that the gateway system can prepare to marshall them correctly. Gateway methods are not restricted to primitive types.
 * * ? version ?
 *
 * Gateway definition classes must be in a directory or package that is accessible to both frontend and backend code.
 * Note that the Gateway base class is defined in `@bentley/imodeljs-common`.
 *
 * <p><em>Example:</em>
 * ```ts
 * [[include:Gateway.definition]]
 * ```
 *
 * ### Implementing Gateways
 *
 * A gateway *implementation* is a TypeScript class that implements a particular gateway definition and extends [Gateway]($imodeljs-common/Gateway).
 *
 * The implementation class must override each API method defined by the gateway definition, that is, it must actually implement the operations.
 * A best practice is that a gateway implementation should simply forward the calls, so that each method is a one-liner.
 * The called methods should be in the service class, not in the gateway, and should be completely free of gateway details.
 *
 * A gateway definition class is always defined in backend code and is not exposed directly to clients.
 *
 * <p><em>Example:</em>
 * ```ts
 * [[include:Gateway.implementation]]
 * ```
 *
 * ### Configuring Gateways (Service side)
 *
 * A service must expose the gateways that it implements or imports, so that clients can use them.
 *
 * First, the service must call [Gateway.registerImplementation]($imodeljs-common/Gateway#registerImplementation) to register the gateways that it implements, if any.
 *
 * Next, the service must use a [GatewayConfiguration]($imodeljs-common/GatewayConfiguration) to configure the gateways that it wants to expose. It must
 * choose the gateway configuration to use, based on how the service itself is configured. Choices include ....
 *
 * A service can expose multiple gateways.
 * A service can expose both its own implementations, if any, and imported implementations.
 * The service can decide at run time which gateways to expose, perhaps based on deployment parameters.
 *
 * <p><em>Example:</em>
 * ```ts
 * [[include:Gateway.configure]]
 * ```
 * This example shows how a service could configure and expose more than one gateway, including imported gateways.
 * It also shows how to choose the appropriate configuration.
 * It also shows how a service could use [FeatureGates]($imodeljs-common/FeatureGates) to decide which gateways to expose.
 *
 * ### Serving Gateways (Service side)
 *
 * A service must serve out its gateways, so that in-coming client calls/requests on the gateway are forwarded to the
 * gateway implementations.
 *
 * #### Web Server
 *
 * When a service is configured as a Web service, it can use any Web server technology you like. A single function call is required to integrate
 * all configured Gateways with the Web server. For example, if you use express, do this:
 * ```ts
 * const app = express();
 * ...
 * app.post("*", async (req, res) => gatewaysConfig.protocol.handleOperationPostRequest(req, res));
 * ```
 *
 * #### Electron Desktop App
 *
 * When a service is the backend of an Electron desktop app, no additional code is required to serve out gateways, beyond calling GatewayElectronConfiguration to configure them.
 *
 * #### Mobile App
 *
 * When a service is the backend of a mobile app, <em>TBD...</em.
 *
 * ### Configuring and Calling Gateways (Client side)
 *
 * A client (e.g., an app frontend) must configure the gateways that it intends to use.
 * It must use the appropriate [GatewayConfiguration]($imodeljs-common/GatewayConfiguration) for each gateway, depending on how
 * the client itself it configured and how the service that implements the gateway is deployed.
 * ... TBD more details on this ...
 * ... TBD code sample ...
 *
 * A client makes calls on a gateway's [proxy]($imodeljs-common/Gateway#getProxyForGateway). Each method in the proxy forwards the
 * call to the implementation. The call signature for the proxy methods is the same as given in the definition.
 *
 * ### Gateway Performance
 *
 * In some configurations, client and service may be in separate processes. Some configurations marshall calls over the Internet, where
 * both bandwidth and latency can vary widely. Therefore, care must be taken to limit the number and size of round-trips between clients and services.
 * In other words, a gateway's methods must be "chunky" and not "chatty".
 *
 */
/**
 * @docs-group-description Geometry
 * Classes for working with geometry.
 */
/**
 * @docs-group-description iModels
 * Classes for working with iModels.
 * For more information, see [iModel Overview]($docs/overview/overview/IModels.md)
 */
/**
 * @docs-group-description Schemas
 * Classes for working with ECSchemas.
 * For more information: [Executing ECSQL]($docs/learning/learning/ECSQL.md)
 */
/**
 * @docs-group-description Views
 * Classes for working with views of models and elements.
 */
