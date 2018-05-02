/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { FeatureGates } from "@bentley/imodeljs-common";
import { EnvMacroSubst, Id64, DbResult } from "@bentley/bentleyjs-core";
import { IModelDb, Element, ECSqlStatement, IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { initializeGateways } from "./RobotWorldGatewayImpl";
// import { initializeLogging } from "./Logging";
import { Point3d } from "@bentley/geometry-core";
import { RobotWorldSchema } from "./RobotWorldSchema";
// import { Robot } from "./RobotElement";
import * as path from "path";

const defaultsCfg = {
  "ROBOT-WORLD-FEATURE-READWRITE": "true",
  "ROBOT-WORLD-FEATURE-EXPERIMENTAL-METHODS": "false",
  "RobotWorld-DEFAULT-LOG-LEVEL": "Error",
  "RobotWorld-SEQ-URL": "http://localhost",
  "RobotWorld-SEQ-PORT": "5341",
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
      RobotWorldEngine.features.setGate("features", config.features);
    }
  }
// __PUBLISH_EXTRACT_END__

  public static countRobotsInArray(iModelDb: IModelDb, elemIds: Id64[]): number {
    let robotCount: number = 0;
    for (const elemId of elemIds) {
      const elem: Element = iModelDb.elements.getElement(elemId);
      if (elem.classFullName === RobotWorldSchema.Class.Robot)
        ++robotCount;
      }
    return robotCount;
  }

  public static countRobots(iModelDb: IModelDb): number {
    return iModelDb.withPreparedStatement("SELECT COUNT(*) from " + RobotWorldSchema.Class.Robot, (stmt: ECSqlStatement): number => {
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        return 0;
      return stmt.getValue(0).getInteger();
    });
  }

  public static queryRobotsHittingObstacles(iModelDb: IModelDb): Id64[] {
    // *** TBD: spatial query
      iModelDb.elements;
      return [];
  }

  public static moveRobot(iModelDb: IModelDb, id: Id64, location: Point3d) {
    // *** TBD: moveRobot
    iModelDb.elements;
    id.isValid;
    location.x;
  }

// __PUBLISH_EXTRACT_START__ FeatureGates.checkFeatureGates
  // An experimental method. It's in the release build, but only turned on in some deployments.
  public static fuseRobots(iModelDb: IModelDb, r1: Id64, r2: Id64, location: Point3d) {
      if (!RobotWorldEngine.features.check("experimentalMethods"))
        return;

      // *** TBD: new fuse operation
      iModelDb.elements;
      r1.isValid();
      r2.isValid();
      location.x;
    }
// __PUBLISH_EXTRACT_END__

  public static insertRobot(iModelDb: IModelDb, name: string, location: Point3d): Id64 {
    // *** TBD: insert a barrier
    iModelDb.elements;
    name.length;
    location.x;
    return new Id64();
  }

  public static insertObstacle(iModelDb: IModelDb, location: Point3d): Id64 {
    // *** TBD: insert a obstacle
      iModelDb.elements;
      location.x;
      return new Id64();
  }

  public static initialize() {
    const config = new IModelHostConfiguration();
    config.appAssetsDir = path.join(__dirname, "assets");
    IModelHost.startup(config);

    RobotWorldEngine.readFeatureGates();
    // initializeLogging();
    initializeGateways();

    RobotWorldSchema.registerSchema();
  }

}
