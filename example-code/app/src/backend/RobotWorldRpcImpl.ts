/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ RpcInterface.initializeBackendForElectron
import { ElectronBackend } from "@bentley/electron-manager/lib/ElectronBackend";
// __PUBLISH_EXTRACT_END__
/* eslint-disable no-duplicate-imports */
// Disable this because it is intentionally separated.
import { Angle, AngleProps, Point3d, XYZProps } from "@bentley/geometry-core";
import { IModelDb } from "@bentley/imodeljs-backend";
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { BentleyCloudRpcManager, BentleyCloudRpcParams, IModelRpcProps, RpcInterface, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { RobotWorldReadRpcInterface, RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";
import { RobotWorldEngine } from "./RobotWorldEngine";

// Implement RobotWorldReadRpcInterface
export class RobotWorldReadRpcImpl extends RpcInterface implements RobotWorldReadRpcInterface {
  public async countRobotsInArray(tokenProps: IModelRpcProps, elemIds: Id64String[]): Promise<number> {
    const iModelDb: IModelDb = IModelDb.findByKey(tokenProps.key);
    return RobotWorldEngine.countRobotsInArray(iModelDb, elemIds);
  }

  public async countRobots(tokenProps: IModelRpcProps): Promise<number> {
    const iModelDb: IModelDb = IModelDb.findByKey(tokenProps.key);
    return RobotWorldEngine.countRobots(iModelDb);
  }

  public async queryObstaclesHitByRobot(tokenProps: IModelRpcProps, rid: Id64String): Promise<Id64String[]> {
    const iModelDb: IModelDb = IModelDb.findByKey(tokenProps.key);
    return RobotWorldEngine.queryObstaclesHitByRobot(iModelDb, rid);
  }
}
// Implement RobotWorldWriteRpcInterface
export class RobotWorldWriteRpcImpl extends RpcInterface implements RobotWorldWriteRpcInterface {
  public async insertRobot(tokenProps: IModelRpcProps, modelId: Id64String, name: string, location: XYZProps): Promise<Id64String> {
    return RobotWorldEngine.insertRobot(IModelDb.findByKey(tokenProps.key), modelId, name, Point3d.fromJSON(location));
  }

  public async moveRobot(tokenProps: IModelRpcProps, id: Id64String, location: XYZProps): Promise<void> {
    RobotWorldEngine.moveRobot(IModelDb.findByKey(tokenProps.key), id, Point3d.fromJSON(location));
  }

  public async insertBarrier(tokenProps: IModelRpcProps, modelId: Id64String, location: XYZProps, angle: AngleProps, length: number): Promise<Id64String> {
    return RobotWorldEngine.insertBarrier(IModelDb.findByKey(tokenProps.key), modelId, Point3d.fromJSON(location), Angle.fromJSON(angle), length);
  }
}

export function initializeRpcImplBentleyCloud(interfaces: RpcInterfaceDefinition[]) {
  const cloudParams: BentleyCloudRpcParams = { info: { title: "RobotWorldEngine", version: "v1.0" } };
  BentleyCloudRpcManager.initializeImpl(cloudParams, interfaces);
}
export async function initializeForElectron(rpcInterfaces: RpcInterfaceDefinition[]) {
  ElectronBackend.initialize({ rpcInterfaces });
}

// __PUBLISH_EXTRACT_END__
