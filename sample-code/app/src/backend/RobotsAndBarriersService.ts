/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { FeatureGates } from "@bentley/imodeljs-common";
import { EnvMacroSubst, Id64, DbResult } from "@bentley/bentleyjs-core";
import { IModelDb, Element, ECSqlStatement } from "@bentley/imodeljs-backend";
import { initializeGateways } from "./RBSGatewayImpl";
import { Point3d } from "@bentley/geometry-core";

// An example of how to implement a service.
// This example manages a fictional domain called "robots and barriers",
// where robots move around on a grid, and they encounter fixed barriers.
// The service exposes APIs to manage robots and barriers and to query their state.
// In particular, the service does collision detection between robots and barriers.
export class RobotsAndBarriersService {

// __PUBLISH_EXTRACT_START__ FeatureGates.defineFeatureGates
  public static features: FeatureGates = new FeatureGates();

  private static readFeatureGates(): void {
    RobotsAndBarriersService.features = new FeatureGates();

    // Read the configuration parameters for my service. Some config
    // params might be specified as envvars.
    const config = require("./RobotsAndBarriersService.config.json");
    EnvMacroSubst.replaceInProperties(config, true, {});

    // Define the feature gates that were passed in the config parameters.
    if ("features" in config) {
      RobotsAndBarriersService.features.setGate("features", config.features);
    }
  }
// __PUBLISH_EXTRACT_END__

  public static countRobotsInArray(iModelDb: IModelDb, elemIds: Id64[]): number {
    let robotCount: number = 0;
    for (const elemId of elemIds) {
      const elem: Element = iModelDb.elements.getElement(elemId);
      if (elem.classFullName === "RB:Robot")
        ++robotCount;
      }
    return robotCount;
  }

  public static countRobots(iModelDb: IModelDb): number {
    return iModelDb.withPreparedStatement("SELECT COUNT(*) from RB:Robot", (stmt: ECSqlStatement): number => {
      if (stmt.step() !== DbResult.BE_SQLITE_ROW)
        return 0;
      return stmt.getValue(0).getInteger();
    });
  }

  public static queryRobotsHittingBarriers(iModelDb: IModelDb): Id64[] {
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
      if (RobotsAndBarriersService.features.check("experimentalMethods") === undefined)
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

  public static insertBarrier(iModelDb: IModelDb, location: Point3d): Id64 {
    // *** TBD: insert a barrier
      iModelDb.elements;
      location.x;
      return new Id64();
  }

  public static run() {
    RobotsAndBarriersService.readFeatureGates();
    initializeGateways();
    // ... run the service ...
  }

}

RobotsAndBarriersService.run();
