/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Gateway.implementation
import { Gateway, IModelToken, GatewayDefinition, IModelReadGateway, IModelWriteGateway, BentleyCloudGatewayConfiguration, GatewayElectronConfiguration } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { Platform, IModelDb } from "@bentley/imodeljs-backend";
import { RobotsAndBarriersService } from "./RobotsAndBarriersService";
import { RBSReadGateway, RBSWriteGateway } from "../common/RBSGatewayDefinition";
import { Point3d } from "@bentley/geometry-core";

// RobotsAndBarriersService Gateway Implementations

// Definitions must be defined in the service (backend code).

// The implementations 'implement' the definition. The definitions are common
// to clients and this implementation. They definitions could be defined in a location
// in the app's source tree that is common to both frontend and backend.
// If these are service gateways, then they would have to be defined in package.
// import { RBSWriteGateway, RBSReadGateway } from "@my-domain/RBSGateway";

// Implement RBSWriteGateway
class RBSWriteGatewayImpl extends Gateway implements RBSWriteGateway {
  public static register() {
    Gateway.registerImplementation(RBSWriteGateway, RBSWriteGatewayImpl);
  }
  public async insertRobot(iModelToken: IModelToken, name: string, location: Point3d): Promise<Id64> {
    return RobotsAndBarriersService.insertRobot(IModelDb.find(iModelToken), name, location);
  }

  public async moveRobot(iModelToken: IModelToken, id: Id64, location: Point3d): Promise<void> {
    RobotsAndBarriersService.moveRobot(IModelDb.find(iModelToken), id, location);
  }

  public async fuseRobots(iModelToken: IModelToken, r1: Id64, r2: Id64, location: Point3d): Promise<void> {
    RobotsAndBarriersService.fuseRobots(IModelDb.find(iModelToken), r1, r2, location);
  }

  public async insertBarrier(iModelToken: IModelToken, location: Point3d): Promise<Id64> {
    return RobotsAndBarriersService.insertBarrier(IModelDb.find(iModelToken), location);
  }
}

// Implement RBSReadGateway
class RBSReadGatewayImpl extends Gateway implements RBSReadGateway {
  public static register() {
  }

  public async countRobotsInArray(iModelToken: IModelToken, elemIds: Id64[]): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotsAndBarriersService.countRobotsInArray(iModelDb, elemIds);
  }

  public async countRobots(iModelToken: IModelToken): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotsAndBarriersService.countRobots(iModelDb);
  }

  public async queryRobotsHittingBarriers(iModelToken: IModelToken): Promise<Id64[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotsAndBarriersService.queryRobotsHittingBarriers(iModelDb);
  }

}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Gateway.configure
/* Configure the gateways exposed by this service. */
function configureGateways(gateways: GatewayDefinition[], uriPrefix?: string) {
  if (Platform.imodeljsMobile !== undefined) {
    // TBD: InAppConfiguration.initialize({}, gateways);
  } else if (Platform.getElectron() !== undefined) {
    GatewayElectronConfiguration.initialize({}, gateways);
  } else {
    BentleyCloudGatewayConfiguration.initialize({ info: { title: "RobotsAndBarriersService", version: "v1.0" }, uriPrefix }, gateways);
  }
}

/* Expose the gateways that are implemented by this service */
export function initializeGateways() {
  // Register my own gateways
  Gateway.registerImplementation(RBSWriteGateway, RBSWriteGatewayImpl);
  Gateway.registerImplementation(RBSReadGateway, RBSReadGatewayImpl);

  // Decide which gateways this service will expose.
  const gateways: GatewayDefinition[] = [IModelReadGateway, RBSReadGateway];

  // This is an example of using a FeatureGate to decide if the
  // service should expose one or more gateways.
  if (RobotsAndBarriersService.features.check("readwrite").toLowerCase() === "true") {
    gateways.push(IModelWriteGateway);
    gateways.push(RBSWriteGateway);
  }

  // Expose the gateways using the appropriate configuration.
  configureGateways(gateways);
}

// __PUBLISH_EXTRACT_END__

initializeGateways();
