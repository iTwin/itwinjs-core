/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ FeatureGates.extendedExample
// This is an example of how a service (or agent or app backend) can read feature
// gates from deployment paramenters and use the gates to filter and control its operations.

import { FeatureGates, Gateway, IModelToken, GatewayDefinition, IModelReadGateway, IModelWriteGateway, BentleyCloudGatewayConfiguration, GatewayElectronConfiguration } from "@bentley/imodeljs-common";
import { EnvMacroSubst, Id64 } from "@bentley/bentleyjs-core";
import { Platform, IModelDb, Element } from "@bentley/imodeljs-backend";

// Example service implementation.
// This example concentrates on part of the service initialization logic.
class MyService {

  public static features: FeatureGates = new FeatureGates();

  private static readFeatureGates(): void {
    MyService.features = new FeatureGates();

    // Read the configuration parameters for my service. Some config
    // params might be specified as envvars.
    const config = require("./MyService.config.json");
    EnvMacroSubst.replaceInProperties(config, true, {});

    // Define the feature gates that were passed in the config parameters.
    if ("features" in config) {
      MyService.features.setGate("features", config.features);
    }

    // See below for where MyService checks the FeatureGates.
  }

  /* Expose the gateways that are implemented by this service */
  private static initializeGateways() {
    // Register my own gateways
    MyServiceGateway1Impl.register();
    MyServiceGateway2Impl.register();

    // Decide which gateways this service will expose.
    const gateways: GatewayDefinition[] = [IModelReadGateway, MyServiceGateway1];

    // This is an example of using a FeatureGate to decide if the
    // service should expose a gateway that is supplied by iModelJs-backend.
    if (MyService.features.check("readwrite").toLowerCase() === "true")
      gateways.push(IModelWriteGateway);

    // This is an example of using a FeatureGate to decide if the
    // service should expose a gateway that is private to the service.
    if (MyService.features.check("gateway2").toLowerCase() === "true")
      gateways.push(MyServiceGateway2);

    // Expose the gateways using the appropriate configuration.
    configureGateways(gateways);
  }

  /* Count elements that have parents */
  public static countChildren(iModelDb: IModelDb, elemIds: Id64[], someParameter: number): number {
    let childCount: number = 0;
    for (const elemId of elemIds) {
      const elem: Element = iModelDb.elements.getElement(elemId);
      if ((elem.parent !== undefined) && (MyService.maybeRunNewFeature(elem) !== "")) {
        // Count the number of the specified elements that have parents.
        ++childCount;
      }
    }

    // This is an example of using a FeatureGate to decide if some new
    // functionality should be executed or not. This is a silly example.
    if (MyService.features.check("newFeature3") === "true")
      childCount += someParameter;

    return childCount;
  }

  /* Maybe run some new feature */
  public static maybeRunNewFeature(_elem: Element): string {

    // ... do some new calculation on the specified element
    // ...
    return "something";
  }

  public static run() {
    MyService.readFeatureGates();
    MyService.initializeGateways();
    // ... run the service ...
  }

}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Gateway.definition

// ---- MyService Gateway *Definitions* ----
// These classes are common to MyService and its clients.
// If these are app-specific gateways, then they would be defined in a directory
// in the app's source tree that is common to both frontend and backend.
// If these are service gateways, then they would be defined in a gateway
// definition package that is accessible by both the
// service implementation and the clients that use the service.

// Interface for Gateway#1
abstract class MyServiceGateway1 extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    IModelToken,
    Id64,
  ]

  /** Returns the OpwsGateway proxy instance for the frontend. */
  public static getProxy(): MyServiceGateway1 {
    return Gateway.getProxyForGateway(MyServiceGateway1);
  }

  /** Example of a gateway method.
   * @param _iModelToken  The imodel.
   * @param _elemIds Example of the kind of arguments that a gateway method can take.
   * @param _someParameter Example of the kind of arguments that a gateway method can take.
   * @return a promise of a return value of some type
   * @throws [[IModelError]] if the update or save fails.
   */
  public async doSomething(_iModelToken: IModelToken, _elemIds: Id64[], _someParameter: number): Promise<number> {
    return this.forward.apply(this, arguments);
  }
}

// Interface for Gateway#1
abstract class MyServiceGateway2 extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    IModelToken,
  ]

  /** Returns the OpwsGateway proxy instance for the frontend. */
  public static getProxy(): MyServiceGateway2 {
    return Gateway.getProxyForGateway(MyServiceGateway2);
  }

  /** Example of a gateway method.
   * @param _iModelToken  The imodel.
   * @param _param1 Example of the kind of arguments that a gateway method can take.
   * @return a promise of a return value of some type
   * @throws [[IModelError]] if the update or save fails.
   */
  public async doSomething2(_iModelToken: IModelToken, _param1: string): Promise<string> {
    return this.forward.apply(this, arguments);
  }
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Gateway.implementation
// These classes are specific to MyService itself. They are backend code.
// They must be defined in the service itself.

// If these are app-specific gateways, then they would be defined in and imported from a directory
// in the app's source tree that is common to both frontend and backend.
// If these are service gateways, then they would be defined in and imported froms a gateway
// definition package.
// import { MyServiceGateway1, MyServiceGateway2 } from "@bentley/MyServiceGateway";

class MyServiceGateway1Impl extends Gateway implements MyServiceGateway1 {
  public static register() {
    Gateway.registerImplementation(MyServiceGateway1, MyServiceGateway1Impl);
  }

  public async doSomething(iModelToken: IModelToken, elemIds: Id64[], someParameter: number): Promise<number> {
    // The implementation of the gateway method would implement the operation
    // Typically, the gateway impl itself just forwards the request to the service.
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return MyService.countChildren(iModelDb, elemIds, someParameter);
  }
}

class MyServiceGateway2Impl extends Gateway implements MyServiceGateway2 {
  public static register() {
    Gateway.registerImplementation(MyServiceGateway2, MyServiceGateway2Impl);
  }

  public async doSomething2(_iModelToken: IModelToken, _param1: string): Promise<string> {
    // ... do something ...
    return "some string value";
  }
}

/* Configure the gateways exposed by this service. */
function configureGateways(gateways: GatewayDefinition[], uriPrefix?: string) {
  if (Platform.imodeljsMobile !== undefined) {
    // TBD: InAppConfiguration.initialize({}, gateways);
  } else if (Platform.getElectron() !== undefined) {
    GatewayElectronConfiguration.initialize({}, gateways);
  } else {
    BentleyCloudGatewayConfiguration.initialize({ info: { title: "MyService", version: "v1.0" }, uriPrefix }, gateways);
  }
}

// __PUBLISH_EXTRACT_END__

MyService.run();
