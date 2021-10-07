/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { IModelRpcProps, RpcInterface, RpcInterfaceDefinition } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { IModelDb } from "@itwin/core-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadRpcInterface } from "../common/RobotWorldRpcInterface";

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
// __PUBLISH_EXTRACT_END__

/* eslint-disable no-duplicate-imports */ // Disable this because it is intentionally separated.
import { Angle, AngleProps, Point3d, XYZProps } from "@itwin/core-geometry";
import { RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";

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

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeForCloud
import { BentleyCloudRpcManager, BentleyCloudRpcParams } from "@itwin/core-common";

export function initializeRpcImplBentleyCloud(interfaces: RpcInterfaceDefinition[]) {
  const cloudParams: BentleyCloudRpcParams = { info: { title: "RobotWorldEngine", version: "v1.0" } };
  BentleyCloudRpcManager.initializeImpl(cloudParams, interfaces);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.initializeBackendForElectron
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";

export async function initializeForElectron(rpcInterfaces: RpcInterfaceDefinition[]) {
  await ElectronHost.startup({ electronHost: { rpcInterfaces } });
}

// __PUBLISH_EXTRACT_END__
