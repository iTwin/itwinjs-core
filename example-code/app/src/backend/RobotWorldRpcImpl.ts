/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { RpcInterface, IModelToken, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Id64Props } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadRpcInterface } from "../common/RobotWorldRpcInterface";

// Implement RobotWorldReadRpcInterface
export class RobotWorldReadRpcImpl extends RpcInterface implements RobotWorldReadRpcInterface {
  public async countRobotsInArray(iModelToken: IModelToken, elemIds: Id64Props[]): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.countRobotsInArray(iModelDb, elemIds);
  }

  public async countRobots(iModelToken: IModelToken): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.countRobots(iModelDb);
  }

  public async queryObstaclesHitByRobot(iModelToken: IModelToken, rid: Id64Props): Promise<Id64Props[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return RobotWorldEngine.queryObstaclesHitByRobot(iModelDb, rid);
  }
}
// __PUBLISH_EXTRACT_END__

import { Point3d, Angle } from "@bentley/geometry-core";
import { RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";

// Implement RobotWorldWriteRpcInterface
export class RobotWorldWriteRpcImpl extends RpcInterface implements RobotWorldWriteRpcInterface {
  public async insertRobot(iModelToken: IModelToken, modelId: Id64Props, name: string, location: Point3d): Promise<Id64Props> {
    return RobotWorldEngine.insertRobot(IModelDb.find(iModelToken), modelId, name, location);
  }

  public async moveRobot(iModelToken: IModelToken, id: Id64Props, location: Point3d): Promise<void> {
    RobotWorldEngine.moveRobot(IModelDb.find(iModelToken), id, location);
  }

  public async fuseRobots(iModelToken: IModelToken, r1: Id64Props, r2: Id64Props): Promise<void> {
    RobotWorldEngine.fuseRobots(IModelDb.find(iModelToken), r1, r2);
  }

  public async insertBarrier(iModelToken: IModelToken, modelId: Id64Props, location: Point3d, angle: Angle, length: number): Promise<Id64Props> {
    return RobotWorldEngine.insertBarrier(IModelDb.find(iModelToken), modelId, location, angle, length);
  }

}

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeImplBentleyCloud
import { BentleyCloudRpcManager, BentleyCloudRpcParams } from "@bentley/imodeljs-common";

export function initializeRpcImplBentleyCloud(interfaces: RpcInterfaceDefinition[]) {
  const cloudParams: BentleyCloudRpcParams = { info: { title: "RobotWorldEngine", version: "v1.0" } };
  BentleyCloudRpcManager.initializeImpl(cloudParams, interfaces);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeImplDesktop
import { ElectronRpcManager } from "@bentley/imodeljs-common";

export function initializeRpcImplDesktop(interfaces: RpcInterfaceDefinition[]) {
  ElectronRpcManager.initializeImpl({}, interfaces);
}
// __PUBLISH_EXTRACT_END__
