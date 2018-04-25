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
 * For more information [[?]]
 */
/**
 * @docs-group-description BisCore
 * Classes for working with the major classes in the BisCore schema.
 * For more information [[?]]
 */
 /**
  * @docs-group-description Codes
  * Classes for working with Codes.
  * For more information [[?]]
  */
/**
 * @docs-group-description ECSQL
 * Classes for working with ECSQL.
 * For more information: [ECSQL]($docs/learning/learning/ECSQL.md)
 */
/**
 * @docs-group-description Errors
 * Classes for working with errors.
 * For more information [[?]]
 */
/**
 * @docs-group-description FontsAndSymbology
 * Classes for working with fonts, colors, and other symbology.
 * For more information [[?]]
 */
/**
 * @docs-group-description Gateway
 * Classes for working with Gateways. The key class is #Gateway.
 * For more information on the role of gateways in an app, see [Gateways]($docs/overview/overview/App.md#gateways)
 *
 * Gateways are TypeScript classes that represent a channel of communication between a client and a service. The client
 * could be a Web app and the service a shared service in the cloud. Or, the client could be a service itself, calling on another service.
 * Or, the client could be the frontend of an app and the "service" its own backend. The same app could be configured
 * to run as a Web app, a desktop app, and/or a mobile app.
 * In all of these scenarios, Gateways factor out the communication mechanism that is used by client and server.
 * Gateways present a TypeScript API to the client and allow a service to implement the required operations in TypeScript.
 * Neither party needs to be concerned about how the calls are marshalled. Both sides are written purely in TypeScript.
 * A client can use and a service can expose multiple gateways.
 *
 * Defining a gateway begins with the Gateway interface and the client-side proxies. All gateway definitions are derived
 * from the [Gateway]($imodeljs-common/Gateway) class. Note that this class is defined in `imodeljs-common`, as gateway definitions
 * are common to both client and service.
 * <p><em>Example:</em>
 * ```ts
 * [[include:Gateway.definition]]
 * ```
 *
 * A service implements a particular gateway interface and exposes it when it starts up. The service can decide at run
 * time which gateways to expose, perhaps based on deployment parameters.
 * The service chooses the appropriate [configuration]($imodeljs-common/GatewayConfiguration) for the gateways,
 * based on how the service itself is configured. Configuring a list of gateways does two things: it assigns a
 * protocol to the gateways and it also exposes them.
 * Note that gateway implementations must be [registered]($imodeljs-common/Gateway#registerImplementation)
 * before they are configured. A service can also expose gateways implemented by the packages that it imports.
 * To do that, the server just adds them to the list of gateways to be configured and exposed.
 * <p><em>Example:</em>
 * ```ts
 * [[include:Gateway.implementation]]
 * ```
 *
 * A client (e.g., an app frontend) configures the gateways that it intends to use. To call a method on a gateway,
 * the client gets the method's [proxy]($imodeljs-common/Gateway#getProxyForGateway) and calls that.
 */
/**
 * @docs-group-description Geometry
 * Classes for working with geometry.
 * For more information [[?]]
 */
/**
 * @docs-group-description iModels
 * Classes for working with iModels.
 * For more information [[?]]
 */
/**
 * @docs-group-description Schemas
 * Classes for working with ECSchemas.
 * For more information [[?]]
 */
/**
 * @docs-group-description Views
 * Classes for working with views of models and elements.
 * For more information [[?]]
 */
