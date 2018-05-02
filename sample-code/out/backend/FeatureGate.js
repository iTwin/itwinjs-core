"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ FeatureGates.extendedExample
// This is an example of how a service (or agent or app backend) can read feature
// gates from deployment paramenters and use the gates to filter and control its operations.
Object.defineProperty(exports, "__esModule", { value: true });
const imodeljs_common_1 = require("@bentley/imodeljs-common");
const bentleyjs_core_1 = require("@bentley/bentleyjs-core");
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
// Example service implementation.
// This example concentrates on part of the service initialization logic.
class MyService {
    static readFeatureGates() {
        MyService.features = new imodeljs_common_1.FeatureGates();
        // Read the configuration parameters for my service. Some config
        // params might be specified as envvars.
        const config = require("./MyService.config.json");
        bentleyjs_core_1.EnvMacroSubst.replaceInProperties(config, true, {});
        // Define the feature gates that were passed in the config parameters.
        if ("features" in config) {
            MyService.features.setGate("features", config.features);
        }
        // See below for where MyService checks the FeatureGates.
    }
    /* Expose the gateways that are implemented by this service */
    static initializeGateways() {
        // Register my own gateways
        MyServiceGateway1Impl.register();
        MyServiceGateway2Impl.register();
        // Decide which gateways this service will expose.
        const gateways = [imodeljs_common_1.IModelReadGateway, MyServiceGateway1];
        // This is an example of using a FeatureGate to decide if the
        // service should expose a gateway that is supplied by iModelJs-backend.
        if (MyService.features.check("readwrite").toLowerCase() === "true")
            gateways.push(imodeljs_common_1.IModelWriteGateway);
        // This is an example of using a FeatureGate to decide if the
        // service should expose a gateway that is private to the service.
        if (MyService.features.check("gateway2").toLowerCase() === "true")
            gateways.push(MyServiceGateway2);
        // Expose the gateways using the appropriate configuration.
        configureGateways(gateways);
    }
    /* Count elements that have parents */
    static countChildren(iModelDb, elemIds, someParameter) {
        let childCount = 0;
        for (const elemId of elemIds) {
            const elem = iModelDb.elements.getElement(elemId);
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
    static maybeRunNewFeature(_elem) {
        // ... do some new calculation on the specified element
        // ...
        return "something";
    }
    static run() {
        MyService.readFeatureGates();
        MyService.initializeGateways();
        // ... run the service ...
    }
}
MyService.features = new imodeljs_common_1.FeatureGates();
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
class MyServiceGateway1 extends imodeljs_common_1.Gateway {
    /** Returns the OpwsGateway proxy instance for the frontend. */
    static getProxy() {
        return imodeljs_common_1.Gateway.getProxyForGateway(MyServiceGateway1);
    }
    /** Example of a gateway method.
     * @param _iModelToken  The imodel.
     * @param _elemIds Example of the kind of arguments that a gateway method can take.
     * @param _someParameter Example of the kind of arguments that a gateway method can take.
     * @return a promise of a return value of some type
     * @throws [[IModelError]] if the update or save fails.
     */
    async doSomething(_iModelToken, _elemIds, _someParameter) {
        return this.forward.apply(this, arguments);
    }
}
/** The version of the gateway. */
MyServiceGateway1.version = "1.0.0";
/** The types that can be marshaled by the gateway. */
MyServiceGateway1.types = () => [
    imodeljs_common_1.IModelToken,
    bentleyjs_core_1.Id64,
];
// Interface for Gateway#1
class MyServiceGateway2 extends imodeljs_common_1.Gateway {
    /** Returns the OpwsGateway proxy instance for the frontend. */
    static getProxy() {
        return imodeljs_common_1.Gateway.getProxyForGateway(MyServiceGateway2);
    }
    /** Example of a gateway method.
     * @param _iModelToken  The imodel.
     * @param _param1 Example of the kind of arguments that a gateway method can take.
     * @return a promise of a return value of some type
     * @throws [[IModelError]] if the update or save fails.
     */
    async doSomething2(_iModelToken, _param1) {
        return this.forward.apply(this, arguments);
    }
}
/** The version of the gateway. */
MyServiceGateway2.version = "1.0.0";
/** The types that can be marshaled by the gateway. */
MyServiceGateway2.types = () => [
    imodeljs_common_1.IModelToken,
];
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ Gateway.implementation
// These classes are specific to MyService itself. They are backend code.
// They must be defined in the service itself.
// If these are app-specific gateways, then they would be defined in and imported from a directory
// in the app's source tree that is common to both frontend and backend.
// If these are service gateways, then they would be defined in and imported froms a gateway
// definition package.
// import { MyServiceGateway1, MyServiceGateway2 } from "@bentley/MyServiceGateway";
class MyServiceGateway1Impl extends imodeljs_common_1.Gateway {
    static register() {
        imodeljs_common_1.Gateway.registerImplementation(MyServiceGateway1, MyServiceGateway1Impl);
    }
    async doSomething(iModelToken, elemIds, someParameter) {
        // The implementation of the gateway method would implement the operation
        // Typically, the gateway impl itself just forwards the request to the service.
        const iModelDb = imodeljs_backend_1.IModelDb.find(iModelToken);
        return MyService.countChildren(iModelDb, elemIds, someParameter);
    }
}
class MyServiceGateway2Impl extends imodeljs_common_1.Gateway {
    static register() {
        imodeljs_common_1.Gateway.registerImplementation(MyServiceGateway2, MyServiceGateway2Impl);
    }
    async doSomething2(_iModelToken, _param1) {
        // ... do something ...
        return "some string value";
    }
}
/* Configure the gateways exposed by this service. */
function configureGateways(gateways, uriPrefix) {
    if (imodeljs_backend_1.Platform.imodeljsMobile !== undefined) {
        // TBD: InAppConfiguration.initialize({}, gateways);
    }
    else if (imodeljs_backend_1.Platform.getElectron() !== undefined) {
        imodeljs_common_1.GatewayElectronConfiguration.initialize({}, gateways);
    }
    else {
        imodeljs_common_1.BentleyCloudGatewayConfiguration.initialize({ info: { title: "MyService", version: "v1.0" }, uriPrefix }, gateways);
    }
}
// __PUBLISH_EXTRACT_END__
MyService.run();
//# sourceMappingURL=FeatureGate.js.map