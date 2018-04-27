/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { GatewayRegistry } from "./gateway/core/GatewayRegistry";
import { GatewayConfiguration, GatewayConfigurationSupplier } from "./gateway/core/GatewayConfiguration";

// tslint:disable-next-line:ban-types
export interface GatewayDefinition<T extends Gateway = Gateway> { prototype: T; name: string; version: string; types: () => Function[]; }
export type GatewayImplementation<T extends Gateway = Gateway> = new () => T;

/** A gateway is a set of operations exposed by a service that a client can call, using configurable protocols, in a platform-independent way.
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
 * This example shows that a service might implement and expose more than one gateway. In this case, there happen to be two.
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
 * This example shows how a service could implement more than one gateway.
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
export abstract class Gateway {
  /**
   * Initializes a gateway class.
   * <em>note:</em> This function must be called on the frontend and on the backend for each gateway class used by an application.
   */
  public static initialize<T extends Gateway>(definition: GatewayDefinition<T>): void {
    GatewayRegistry.instance.initializeGateway(definition);
  }

  /** Returns the gateway proxy instance for the frontend. */
  public static getProxyForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    return GatewayRegistry.instance.getProxyForGateway(definition);
  }

  /** Registers the gateway implementation class for the backend. */
  public static registerImplementation<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, implementation: GatewayImplementation<TImplementation>): void {
    GatewayRegistry.instance.registerImplementation(definition, implementation);
  }

  /** Supply the instance of the gateway implementation class for the backend (optional). */
  public static supplyImplementationInstance<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, instance: TImplementation): void {
    GatewayRegistry.instance.setImplementationInstance(definition, instance);
  }

  /** The configuration for the gateway. */
  public readonly configuration = GatewayConfiguration.supply(this);

  /** Obtains the implementation result for a gateway operation. */
  public forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    const request = new (this.configuration.protocol.requestType)<T>(this, operation, parameters);
    request.submit();
    return request.response;
  }

  /** @hidden @internal */
  public configurationSupplier: GatewayConfigurationSupplier | undefined;
}

Gateway.prototype.configurationSupplier = undefined;
