/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RelatedElement, RpcInterfaceDefinition, RpcManager, IModelReadRpcInterface, IModelWriteRpcInterface, GeometricElement3dProps } from "@bentley/imodeljs-common";
import { IModelDb, IModelHost, Element, ECSqlStatement, InformationRecordElement, IModelHostConfiguration, KnownLocations, Platform } from "@bentley/imodeljs-backend";
import { EnvMacroSubst, DbResult, Id64Props } from "@bentley/bentleyjs-core";
import { } from "@bentley/imodeljs-common";
import { Point3d, Angle, YawPitchRollAngles } from "@bentley/geometry-core";
import { RobotWorld } from "./RobotWorldSchema";
import { Robot } from "./RobotElement";
import * as path from "path";
import { Barrier } from "./BarrierElement";
import { TestRpcManager } from "@bentley/imodeljs-common/lib/rpc/TestRpcManager";
import { RobotWorldWriteRpcInterface, RobotWorldReadRpcInterface } from "../common/RobotWorldRpcInterface";
import { RobotWorldWriteRpcImpl, RobotWorldReadRpcImpl } from "./RobotWorldRpcImpl";

const defaultsCfg = {
  "ROBOT-WORLD-FEATURE-READWRITE": "true",
  "ROBOT-WORLD-FEATURE-EXPERIMENTAL-METHODS": "false",
  "ROBOT-WORLD-DEFAULT-LOG-LEVEL": "Error",
  "ROBOT-WORLD-SEQ-URL": "http://localhost",
  "ROBOT-WORLD-SEQ-PORT": "5341",
};

// An example of how to implement a service.
// This example manages a fictional domain called "robot world",
// where robots move around on a grid, and they bump into each obstacles,
// including other robots and fixed barriers.
// The service exposes APIs to manage robots and barriers and to query their state.
// In particular, the service does collision detection between robots and obstacles.
export class RobotWorldEngine {

  // __PUBLISH_EXTRACT_START__ FeatureGates.defineFeatureGates

  private static readFeatureGates(): void {

    // Read the configuration parameters for my service.
    // Some config params might be specified as envvars. Substitute actual values.
    const config = require(path.join(IModelHost.appAssetsDir!, "RobotWorldEngine.config.json"));
    EnvMacroSubst.replaceInProperties(config, true, defaultsCfg);

    // Define the feature gates that were passed in the config parameters on IModelHost, using "robot" as the key.
    IModelHost.features.setGate("robot", config.features);
  }
  // __PUBLISH_EXTRACT_END__

  public static countRobotsInArray(iModelDb: IModelDb, elemIds: Id64Props[]): number {
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
  public static queryObstaclesHitByRobot(iModelDb: IModelDb, rid: Id64Props): Id64Props[] {
    const robot1 = iModelDb.elements.getElement(rid) as Robot;

    const selStmt =
      `SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox) AND rt.ECInstanceId <> :thisRobot`;

    return iModelDb.withPreparedStatement(selStmt, (stmt: ECSqlStatement) => {
      stmt.bindRange3d("bbox", robot1.placement.calculateRange());
      stmt.bindId("thisRobot", rid);
      const hits: Id64Props[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        hits.push(stmt.getValue(0).getId());
      }
      return hits;
    });
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ECSqlStatement.spatialQuery
  public static queryBarriersHitByRobot(iModelDb: IModelDb, rid: Id64Props): Id64Props[] {
    const robot1 = iModelDb.elements.getElement(rid) as Robot;

    const selStmt =
      `SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox) AND rt.ECInstanceId <> :thisRobot`;

    return iModelDb.withPreparedStatement(selStmt, (stmt: ECSqlStatement) => {
      stmt.bindRange3d("bbox", robot1.placement.calculateRange());
      stmt.bindId("thisRobot", rid);
      const hits: Id64Props[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        hits.push(stmt.getValue(0).getId());
      }
      return hits;
    });
  }
  // __PUBLISH_EXTRACT_END__

  public static moveRobot(iModelDb: IModelDb, id: Id64Props, location: Point3d) {
    const r = iModelDb.elements.getElement(id) as Robot;
    r.placement.origin = location;
    iModelDb.elements.updateElement(r);
  }

  // __PUBLISH_EXTRACT_START__ FeatureGates.checkFeatureGates
  // An experimental method. It is in the release build, but only turned on in some deployments.
  public static fuseRobots(iModelDb: IModelDb, r1Id: Id64Props, r2Id: Id64Props) {
    if (!IModelHost.features.check("robot.experimental.methods"))
      return;

    // The gate is open. Go ahead and perform the function.
    // ...
    // __PUBLISH_EXTRACT_END__
    // Create an assembly with r1 and r2 as the children and a new (hidden) element as the head.
    const r1 = iModelDb.elements.getElement(r1Id) as Robot;
    const r2 = iModelDb.elements.getElement(r2Id) as Robot;
    const parent = iModelDb.elements.createElement({ classFullName: InformationRecordElement.classFullName, model: r1.model });
    const parentId = iModelDb.elements.insertElement(parent);
    r1.parent = new RelatedElement({ id: parentId });
    r2.parent = new RelatedElement({ id: parentId });
    iModelDb.elements.updateElement(r1);
    iModelDb.elements.updateElement(r2);
  }

  // __PUBLISH_EXTRACT_START__ Element.createGeometricElement3d.example-code
  public static insertRobot(iModelDb: IModelDb, modelId: Id64Props, name: string, location: Point3d): Id64Props {
    const props: GeometricElement3dProps = {      // I know what class and category to use.
      model: modelId,
      classFullName: RobotWorld.Class.Robot,
      category: Robot.getCategory(iModelDb).id,
      geom: Robot.generateGeometry(),
      placement: { origin: location, angles: new YawPitchRollAngles() },
      userLabel: name,
    };
    return iModelDb.elements.insertElement(props);
  }
  // __PUBLISH_EXTRACT_END__

  public static insertBarrier(iModelDb: IModelDb, modelId: Id64Props, location: Point3d, angle: Angle, length: number): Id64Props {
    const props: GeometricElement3dProps = {      // I know what class and category to use.
      model: modelId,
      classFullName: RobotWorld.Class.Barrier,
      category: Barrier.getCategory(iModelDb).id,
      geom: Barrier.generateGeometry(length),
      placement: { origin: location, angles: new YawPitchRollAngles(angle, Angle.zero(), Angle.zero()) },
    };
    return iModelDb.elements.insertElement(props);
  }

  public static initialize() {
    const config = new IModelHostConfiguration();
    if (Platform.isNodeJs)
      config.appAssetsDir = path.join(__dirname, "assets");
    else
      config.appAssetsDir = KnownLocations.packageAssetsDir;
    IModelHost.startup(config);

    this.readFeatureGates();

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
      RobotWorld.importSchema(iModel);
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
