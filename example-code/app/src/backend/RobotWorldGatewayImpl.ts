/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Gateway.implementation
import { Gateway, IModelToken, GatewayDefinition, IModelReadGateway, IModelWriteGateway, BentleyCloudGatewayConfiguration, GatewayElectronConfiguration } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { Platform, IModelDb } from "@bentley/imodeljs-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadGateway, RobotWorldWriteGateway } from "../common/RobotWorldGatewayDefinition";
import { Point3d } from "@bentley/geometry-core";

// RobotWorldEngine Gateway Implementations

// Definitions must be defined in the service (backend code).

// The implementations 'implement' the definition. The definitions are common
// to clients and this implementation. They definitions could be defined in a location
// in the app's source tree that is common to both frontend and backend.
// If these are service gateways, then they would have to be defined in package.
// import { ROWriteGateway, ROReadGateway } from "@my-domain/ROGateway";

// Implement ROWriteGateway
class RobotWorldWriteGatewayImpl extends Gateway implements RobotWorldWriteGateway {
  public static register() {
    Gateway.registerImplementation(RobotWorldWriteGateway, RobotWorldWriteGatewayImpl);
  }
  public async insertRobot(iModelToken: IModelToken, name: string, location: Point3d): Promise<Id64> {
    return RobotWorldEngine.insertRobot(IModelDb.find(iModelToken), name, location);
  }

  public async moveRobot(iModelToken: IModelToken, id: Id64, location: Point3d): Promise<void> {
    RobotWorldEngine.moveRobot(IModelDb.find(iModelToken), id, location);
  }

  public async fuseRobots(iModelToken: IModelToken, r1: Id64, r2: Id64, location: Point3d): Promise<void> {
    RobotWorldEngine.fuseRobots(IModelDb.find(iModelToken), r1, r2, location);
  }

  public async insertObstacle(iModelToken: IModelToken, location: Point3d): Promise<Id64> {
    return RobotWorldEngine.insertObstacle(IModelDb.find(iModelToken), location);
  }
}

// Implement ROReadGateway
class RobotWorldReadGatewayImpl extends Gateway implements RobotWorldReadGateway {
  public static register() {
  }

  public async countRobotsInArray(iModelToken: IModelToken, elemIds: Id64[]): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.countRobotsInArray(iModelDb, elemIds);
  }

  public async countRobots(iModelToken: IModelToken): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.countRobots(iModelDb);
  }

  public async queryRobotsHittingObstacles(iModelToken: IModelToken): Promise<Id64[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.queryRobotsHittingObstacles(iModelDb);
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
    BentleyCloudGatewayConfiguration.initialize({ info: { title: "RobotWorldEngine", version: "v1.0" }, uriPrefix }, gateways);
  }
}

/* Expose the gateways that are implemented by this service */
export function initializeGateways() {
  // Register my own gateways
  Gateway.registerImplementation(RobotWorldWriteGateway, RobotWorldWriteGatewayImpl);
  Gateway.registerImplementation(RobotWorldReadGateway, RobotWorldReadGatewayImpl);

  // Decide which gateways this service will expose.

  // Start with the gateways that we know that we want to expose.
  // Note that this is an example of exposing more than one gateway from a single service.
  // It's also an example of exposing both a gateway that is implemented by an imported package
  // and a gateway that is implemented by the service.
  const gateways: GatewayDefinition[] = [IModelReadGateway, RobotWorldReadGateway];

  // This is an example of using a FeatureGate to decide at runtime if the
  // service should expose one or more gateways.
  if (RobotWorldEngine.features.check("readwrite")) {
    gateways.push(IModelWriteGateway);
    gateways.push(RobotWorldWriteGateway);
  }

  // Expose the gateways using the appropriate configuration.
  configureGateways(gateways);
}

// __PUBLISH_EXTRACT_END__
