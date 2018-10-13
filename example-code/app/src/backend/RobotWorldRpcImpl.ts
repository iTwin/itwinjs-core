/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.implementation
import { RpcInterface, IModelToken, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Id64String, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { RobotWorldEngine } from "./RobotWorldEngine";
import { RobotWorldReadRpcInterface } from "../common/RobotWorldRpcInterface";

// Implement RobotWorldReadRpcInterface
export class RobotWorldReadRpcImpl extends RpcInterface implements RobotWorldReadRpcInterface {
    public async countRobotsInArray(iModelToken: IModelToken, elemIds: Id64String[]): Promise<number> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const iModelDb: IModelDb = IModelDb.find(iModelToken);
        return RobotWorldEngine.countRobotsInArray(iModelDb, elemIds);
    }

    public async countRobots(iModelToken: IModelToken): Promise<number> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const iModelDb: IModelDb = IModelDb.find(iModelToken);
        return RobotWorldEngine.countRobots(iModelDb);
    }

    public async queryObstaclesHitByRobot(iModelToken: IModelToken, rid: Id64String): Promise<Id64String[]> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        const iModelDb: IModelDb = IModelDb.find(iModelToken);
        return RobotWorldEngine.queryObstaclesHitByRobot(iModelDb, rid);
    }
}
// __PUBLISH_EXTRACT_END__

import { Point3d, Angle } from "@bentley/geometry-core";
import { RobotWorldWriteRpcInterface } from "../common/RobotWorldRpcInterface";

// Implement RobotWorldWriteRpcInterface
export class RobotWorldWriteRpcImpl extends RpcInterface implements RobotWorldWriteRpcInterface {
    public async insertRobot(iModelToken: IModelToken, modelId: Id64String, name: string, location: Point3d): Promise<Id64String> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        return RobotWorldEngine.insertRobot(IModelDb.find(iModelToken), modelId, name, location);
    }

    public async moveRobot(iModelToken: IModelToken, id: Id64String, location: Point3d): Promise<void> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
        RobotWorldEngine.moveRobot(IModelDb.find(iModelToken), id, location);
    }

    public async insertBarrier(iModelToken: IModelToken, modelId: Id64String, location: Point3d, angle: Angle, length: number): Promise<Id64String> {
        const activityContext = ActivityLoggingContext.current; activityContext.enter();
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
