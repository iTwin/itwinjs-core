/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { RpcInterface, RpcInterfaceDefinition, IModelTokenProps, IModelToken } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadRpcInterface } from "../common/RobotWorldRpcInterface";

// Implement RobotWorldReadRpcInterface
export class RobotWorldReadRpcImpl extends RpcInterface implements RobotWorldReadRpcInterface {
  public async countRobotsInArray(tokenProps: IModelTokenProps, elemIds: Id64String[]): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(IModelToken.fromJSON(tokenProps));
    return RobotWorldEngine.countRobotsInArray(iModelDb, elemIds);
  }

  public async countRobots(tokenProps: IModelTokenProps): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(IModelToken.fromJSON(tokenProps));
    return RobotWorldEngine.countRobots(iModelDb);
  }

  public async queryObstaclesHitByRobot(tokenProps: IModelTokenProps, rid: Id64String): Promise<Id64String[]> {
    const iModelDb: IModelDb = IModelDb.find(IModelToken.fromJSON(tokenProps));
    return RobotWorldEngine.queryObstaclesHitByRobot(iModelDb, rid);
  }
}
// __PUBLISH_EXTRACT_END__

// tslint:disable:no-duplicate-imports - Disable this because it is intentionally separated.
import { Point3d, Angle, XYZProps, AngleProps } from "@bentley/geometry-core";
import { RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";

// Implement RobotWorldWriteRpcInterface
export class RobotWorldWriteRpcImpl extends RpcInterface implements RobotWorldWriteRpcInterface {
  public async insertRobot(tokenProps: IModelTokenProps, modelId: Id64String, name: string, location: XYZProps): Promise<Id64String> {
    return RobotWorldEngine.insertRobot(IModelDb.find(IModelToken.fromJSON(tokenProps)), modelId, name, Point3d.fromJSON(location));
  }

  public async moveRobot(tokenProps: IModelTokenProps, id: Id64String, location: XYZProps): Promise<void> {
    RobotWorldEngine.moveRobot(IModelDb.find(IModelToken.fromJSON(tokenProps)), id, Point3d.fromJSON(location));
  }

  public async insertBarrier(tokenProps: IModelTokenProps, modelId: Id64String, location: XYZProps, angle: AngleProps, length: number): Promise<Id64String> {
    return RobotWorldEngine.insertBarrier(IModelDb.find(IModelToken.fromJSON(tokenProps)), modelId, Point3d.fromJSON(location), Angle.fromJSON(angle), length);
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
