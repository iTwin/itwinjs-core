/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { RpcInterface, RpcInterfaceDefinition, RpcManager, IModelToken, IModelReadRpcInterface, IModelWriteRpcInterface, BentleyCloudRpcManager, ElectronRpcManager } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Platform, IModelDb } from "@bentley/imodeljs-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";
import { Point3d, Angle } from "@bentley/geometry-core";

// Implement ROWriteRpcInterface
class RobotWorldWriteRpcImpl extends RpcInterface implements RobotWorldWriteRpcInterface {
  public static register() {
    RpcManager.registerImpl(RobotWorldWriteRpcInterface, RobotWorldWriteRpcImpl);
  }
  public async insertRobot(iModelToken: IModelToken, modelId: Id64, name: string, location: Point3d): Promise<Id64> {
    return RobotWorldEngine.insertRobot(IModelDb.find(iModelToken), modelId, name, location);
  }

  public async moveRobot(iModelToken: IModelToken, id: Id64, location: Point3d): Promise<void> {
    RobotWorldEngine.moveRobot(IModelDb.find(iModelToken), id, location);
  }

  public async fuseRobots(iModelToken: IModelToken, r1: Id64, r2: Id64): Promise<void> {
    RobotWorldEngine.fuseRobots(IModelDb.find(iModelToken), r1, r2);
  }

  public async insertBarrier(iModelToken: IModelToken, modelId: Id64, location: Point3d, angle: Angle, length: number): Promise<Id64> {
    return RobotWorldEngine.insertBarrier(IModelDb.find(iModelToken), modelId, location, angle, length);
  }
}

// Implement ROReadRpcInterface
class RobotWorldReadRpcImpl extends RpcInterface implements RobotWorldReadRpcInterface {
  public static register() {
    RpcManager.registerImpl(RobotWorldReadRpcInterface, RobotWorldReadRpcImpl);
  }

  public async countRobotsInArray(iModelToken: IModelToken, elemIds: Id64[]): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.countRobotsInArray(iModelDb, elemIds);
  }

  public async countRobots(iModelToken: IModelToken): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.countRobots(iModelDb);
  }

  public async queryObstaclesHitByRobot(iModelToken: IModelToken, rid: Id64): Promise<Id64[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.queryObstaclesHitByRobot(iModelDb, rid);
  }

}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeClient
/* Initialize the RPC clients used by this service. */
export function initializeRpcClient(interfaces: RpcInterfaceDefinition[], uriPrefix?: string) {
  if (Platform.isMobile()) {
    assert(false, "TBD: mobile RPC config");
  } else if (Platform.electron !== undefined) {
    ElectronRpcManager.initializeClient({}, interfaces);
  } else {
    BentleyCloudRpcManager.initializeClient({ info: { title: "RobotWorldEngine", version: "v1.0" }, uriPrefix }, interfaces);
  }
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeImpl
/* Configures the RPC implementations that are implemented by this service */
export function initializeRpcImpl() {
  // Register my own interfaces
  RpcManager.registerImpl(RobotWorldWriteRpcInterface, RobotWorldWriteRpcImpl);
  RpcManager.registerImpl(RobotWorldReadRpcInterface, RobotWorldReadRpcImpl);

  // Decide which interfaces this service will expose.

  // Start with the interfaces that we know that we want to expose.
  // Note that this is an example of exposing more than one interface from a single service.
  // It is also an example of exposing both a interface that is implemented by an imported package
  // and a interface that is implemented by the service.
  const interfaces: RpcInterfaceDefinition[] = [IModelReadRpcInterface, RobotWorldReadRpcInterface];

  // This is an example of using a FeatureGate to decide at runtime if the
  // service should expose one or more interfaces.
  if (RobotWorldEngine.features.check("readwrite")) {
    interfaces.push(IModelWriteRpcInterface);
    interfaces.push(RobotWorldWriteRpcInterface);
  }

  // Expose the RpcInterfaces using the appropriate configuration.
  if (Platform.isMobile()) {
    assert(false, "TBD: mobile RPC config");
  } else if (Platform.electron !== undefined) {
    ElectronRpcManager.initializeImpl({}, interfaces);
  } else {
    BentleyCloudRpcManager.initializeImpl({ info: { title: "RobotWorldEngine", version: "v1.0" } }, interfaces);
  }
}

// __PUBLISH_EXTRACT_END__
