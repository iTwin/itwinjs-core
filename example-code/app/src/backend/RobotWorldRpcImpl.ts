/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { RpcInterface, RpcManager, IModelToken } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";
import { Point3d, Angle } from "@bentley/geometry-core";
import { RobotWorld } from "./RobotWorldSchema";

// Implement RobotWorldWriteRpcInterface
export class RobotWorldWriteRpcImpl extends RpcInterface implements RobotWorldWriteRpcInterface {
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

  public async importSchema(iModelToken: IModelToken): Promise<void> {
    return RobotWorld.importSchema(IModelDb.find(iModelToken));
  }
}

// Implement RobotWorldReadRpcInterface
export class RobotWorldReadRpcImpl extends RpcInterface implements RobotWorldReadRpcInterface {
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
