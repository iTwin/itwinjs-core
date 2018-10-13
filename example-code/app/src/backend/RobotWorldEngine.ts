/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition, RpcManager, IModelReadRpcInterface, IModelWriteRpcInterface, GeometricElement3dProps, Code } from "@bentley/imodeljs-common";
import { IModelDb, IModelHost, Element, ECSqlStatement, IModelHostConfiguration, KnownLocations, Platform } from "@bentley/imodeljs-backend";
import { DbResult, Id64String, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { } from "@bentley/imodeljs-common";
import { Point3d, Angle, YawPitchRollAngles } from "@bentley/geometry-core";
import { RobotWorld } from "./RobotWorldSchema";
import { Robot } from "./RobotElement";
import * as path from "path";
import { Barrier } from "./BarrierElement";
import { TestRpcManager } from "@bentley/imodeljs-common/lib/rpc/TestRpcManager";
import { RobotWorldWriteRpcInterface, RobotWorldReadRpcInterface } from "../common/RobotWorldRpcInterface";
import { RobotWorldWriteRpcImpl, RobotWorldReadRpcImpl } from "./RobotWorldRpcImpl";

// An example of how to implement a service.
// This example manages a fictional domain called "robot world",
// where robots move around on a grid, and they bump into each obstacles,
// including other robots and fixed barriers.
// The service exposes APIs to manage robots and barriers and to query their state.
// In particular, the service does collision detection between robots and obstacles.
export class RobotWorldEngine {

    public static countRobotsInArray(iModelDb: IModelDb, elemIds: Id64String[]): number {
        let robotCount: number = 0;
        for (const elemId of elemIds) {
            const elem: Element = iModelDb.elements.getElement(elemId);
            if (elem.classFullName === RobotWorld.Class.Robot)
                ++robotCount;
        }
        return robotCount;
    }

    public static countRobots(iModelDb: IModelDb): number {
        return iModelDb.withPreparedStatement("SELECT COUNT(*) from " + RobotWorld.Class.Robot, (stmt: ECSqlStatement): number => {
            if (stmt.step() !== DbResult.BE_SQLITE_ROW)
                return 0;
            return stmt.getValue(0).getInteger();
        });
    }

    // __PUBLISH_EXTRACT_START__ ECSqlStatement.spatialQuery
    public static queryObstaclesHitByRobot(iModelDb: IModelDb, rid: Id64String): Id64String[] {
        const robot1 = iModelDb.elements.getElement(rid) as Robot;

        const selStmt =
            `SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox) AND rt.ECInstanceId <> :thisRobot`;

        return iModelDb.withPreparedStatement(selStmt, (stmt: ECSqlStatement) => {
            stmt.bindRange3d("bbox", robot1.placement.calculateRange());
            stmt.bindId("thisRobot", rid);
            const hits: Id64String[] = [];
            while (stmt.step() === DbResult.BE_SQLITE_ROW) {
                hits.push(stmt.getValue(0).getId());
            }
            return hits;
        });
    }
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ ECSqlStatement.spatialQuery
    public static queryBarriersHitByRobot(iModelDb: IModelDb, rid: Id64String): Id64String[] {
        const robot1 = iModelDb.elements.getElement(rid) as Robot;

        const selStmt =
            `SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox) AND rt.ECInstanceId <> :thisRobot`;

        return iModelDb.withPreparedStatement(selStmt, (stmt: ECSqlStatement) => {
            stmt.bindRange3d("bbox", robot1.placement.calculateRange());
            stmt.bindId("thisRobot", rid);
            const hits: Id64String[] = [];
            while (stmt.step() === DbResult.BE_SQLITE_ROW) {
                hits.push(stmt.getValue(0).getId());
            }
            return hits;
        });
    }
    // __PUBLISH_EXTRACT_END__

    public static moveRobot(iModelDb: IModelDb, id: Id64String, location: Point3d) {
        const r = iModelDb.elements.getElement(id) as Robot;
        r.placement.origin = location;
        iModelDb.elements.updateElement(r);
    }

    // __PUBLISH_EXTRACT_START__ Element.createGeometricElement3d.example-code
    public static insertRobot(iModelDb: IModelDb, modelId: Id64String, name: string, location: Point3d): Id64String {
        const props: GeometricElement3dProps = {
            model: modelId,
            code: Code.createEmpty(),
            classFullName: RobotWorld.Class.Robot,      // In this example, I know what class and category to use.
            category: Robot.getCategory(iModelDb).id,
            geom: Robot.generateGeometry(),             // In this example, I know how to generate geometry, and I know that the placement is empty.
            placement: { origin: location, angles: new YawPitchRollAngles() },
            userLabel: name,
        };
        return iModelDb.elements.insertElement(props);
    }
    // __PUBLISH_EXTRACT_END__

    public static insertBarrier(iModelDb: IModelDb, modelId: Id64String, location: Point3d, angle: Angle, length: number): Id64String {
        const props: GeometricElement3dProps = {      // I know what class and category to use.
            model: modelId,
            code: Code.createEmpty(),
            classFullName: RobotWorld.Class.Barrier,
            category: Barrier.getCategory(iModelDb).id,
            geom: Barrier.generateGeometry(length),
            placement: { origin: location, angles: new YawPitchRollAngles(angle, Angle.zero(), Angle.zero()) },
        };
        return iModelDb.elements.insertElement(props);
    }

    public static initialize(activityContext: ActivityLoggingContext) {
        const config = new IModelHostConfiguration();
        if (Platform.isNodeJs)
            config.appAssetsDir = path.join(__dirname, "assets");
        else
            config.appAssetsDir = KnownLocations.packageAssetsDir;
        IModelHost.startup(config);

        // Can't to this, as our logging config uses Bunyan/Seq, and we don't really want to do that here.
        // initializeLogging();

        RpcManager.registerImpl(RobotWorldWriteRpcInterface, RobotWorldWriteRpcImpl); // register impls that we don't want in the doc example
        this.registerImpls();
        const interfaces = this.chooseInterfacesToExpose();
        if (IModelHost.features.check("robot.imodel.readwrite"))  // choose add'l interfaces that we don't want in the doc example
            interfaces.push(IModelWriteRpcInterface);
        TestRpcManager.initialize(interfaces);

        // __PUBLISH_EXTRACT_START__ Schema.registerSchema
        // Register the TypeScript schema classes that I intend to use.
        RobotWorld.registerSchema();
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ Schema.importSchema
        // Make sure the RobotWorld schema is in the iModel.
        IModelDb.onOpened.addListener((iModel: IModelDb) => {
            RobotWorld.importSchema(activityContext, iModel);
        });
        // __PUBLISH_EXTRACT_END__
    }

    private static registerImpls() {
        // __PUBLISH_EXTRACT_START__ RpcInterface.registerImpls
        RpcManager.registerImpl(RobotWorldReadRpcInterface, RobotWorldReadRpcImpl);
        // __PUBLISH_EXTRACT_END__
    }

    // __PUBLISH_EXTRACT_START__ RpcInterface.selectInterfacesToExpose
    private static chooseInterfacesToExpose(): RpcInterfaceDefinition[] {
        const interfaces: RpcInterfaceDefinition[] = [IModelReadRpcInterface, RobotWorldReadRpcInterface];

        if (IModelHost.features.check("robot.imodel.readwrite")) {
            interfaces.push(RobotWorldWriteRpcInterface);
        }

        return interfaces;
    }
    // __PUBLISH_EXTRACT_END__

    public static shutdown() {
        IModelHost.shutdown();
    }

}
