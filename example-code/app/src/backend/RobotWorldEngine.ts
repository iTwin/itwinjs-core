/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { FeatureGates, RelatedElement } from "@bentley/imodeljs-common";
import { EnvMacroSubst, Id64, DbResult } from "@bentley/bentleyjs-core";
import { IModelDb, Element, ECSqlStatement, IModelHost, IModelHostConfiguration, Platform, KnownLocations, InformationRecordElement } from "@bentley/imodeljs-backend";
import { initializeRpcImpl } from "./RobotWorldRpcImpl";
// import { initializeLogging } from "./Logging";
import { Point3d, Angle } from "@bentley/geometry-core";
import { RobotWorld } from "./RobotWorldSchema";
import { Robot } from "./RobotElement";
import * as path from "path";
import { Barrier } from "./BarrierElement";

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
  public static features: FeatureGates = new FeatureGates();

  private static readFeatureGates(): void {
    RobotWorldEngine.features = new FeatureGates();

    // Read the configuration parameters for my service.
    // Some config params might be specified as envvars. Substitute actual values.
    const config = require(path.join(IModelHost.appAssetsDir!, "RobotWorldEngine.config.json"));
    EnvMacroSubst.replaceInProperties(config, true, defaultsCfg);

    // Define the feature gates that were passed in the config parameters.
    if ("features" in config) {
      RobotWorldEngine.features.setGate("imodel", config.features.imodel);
      RobotWorldEngine.features.setGate("experimental", config.features.experimental);
      RobotWorldEngine.features.setGate("not_there", config.features.not_there);
    }
  }
  // __PUBLISH_EXTRACT_END__

  public static countRobotsInArray(iModelDb: IModelDb, elemIds: Id64[]): number {
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
  public static queryObstaclesHitByRobot(iModelDb: IModelDb, rid: Id64): Id64[] {
    const robot1 = iModelDb.elements.getElement(rid) as Robot;

    const selStmt =
      `SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox) AND rt.ECInstanceId <> :thisRobot`;

    return iModelDb.withPreparedStatement(selStmt, (stmt: ECSqlStatement) => {
      stmt.bindRange3d("bbox", robot1.placement.calculateRange());
      stmt.bindId("thisRobot", rid);
      const hits: Id64[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        hits.push(new Id64(stmt.getValue(0).getId()));
      }
      return hits;
    });
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ECSqlStatement.spatialQuery
  public static queryBarriersHitByRobot(iModelDb: IModelDb, rid: Id64): Id64[] {
    const robot1 = iModelDb.elements.getElement(rid) as Robot;

    const selStmt =
      `SELECT rt.ECInstanceId FROM BisCore.SpatialIndex rt WHERE rt.ECInstanceId MATCH iModel_spatial_overlap_aabb(:bbox) AND rt.ECInstanceId <> :thisRobot`;

    return iModelDb.withPreparedStatement(selStmt, (stmt: ECSqlStatement) => {
      stmt.bindRange3d("bbox", robot1.placement.calculateRange());
      stmt.bindId("thisRobot", rid);
      const hits: Id64[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        hits.push(new Id64(stmt.getValue(0).getId()));
      }
      return hits;
    });
  }
  // __PUBLISH_EXTRACT_END__

  public static moveRobot(iModelDb: IModelDb, id: Id64, location: Point3d) {
    const r = iModelDb.elements.getElement(id) as Robot;
    r.placement.origin = location;
    iModelDb.elements.updateElement(r);
  }

  // __PUBLISH_EXTRACT_START__ FeatureGates.checkFeatureGates
  // An experimental method. It is in the release build, but only turned on in some deployments.
  public static fuseRobots(iModelDb: IModelDb, r1Id: Id64, r2Id: Id64) {
    if (!RobotWorldEngine.features.check("experimental.methods"))
      return;

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
  // __PUBLISH_EXTRACT_END__

  public static insertRobot(iModelDb: IModelDb, modelId: Id64, name: string, location: Point3d): Id64 {
    const r = Robot.create(iModelDb.models.getModel(modelId), location);
    r.userLabel = name;
    return iModelDb.elements.insertElement(r);
  }

  public static insertBarrier(iModelDb: IModelDb, modelId: Id64, location: Point3d, angle: Angle, length: number): Id64 {
    const r = Barrier.create(iModelDb.models.getModel(modelId), location, angle, length);
    return iModelDb.elements.insertElement(r);
  }

  public static initialize(isTest: boolean) {
    const config = new IModelHostConfiguration();
    if (Platform.isNodeJs())
      config.appAssetsDir = path.join(__dirname, "assets");
    else
      config.appAssetsDir = KnownLocations.platformAssetsDir;
    IModelHost.startup(config);

    RobotWorldEngine.readFeatureGates();
    // initializeLogging();
    initializeRpcImpl(isTest);

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

  public static shutdown() {
    IModelHost.shutdown();
  }

}
