/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64String, OpenMode } from "@itwin/core-bentley";
import { Angle, Point3d } from "@itwin/core-geometry";
import { IModelJsFs, PhysicalModel, StandaloneDb } from "@itwin/core-backend";
import { IModel } from "@itwin/core-common";
import { Barrier } from "../BarrierElement";
import { Robot } from "../RobotElement";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { RobotWorld } from "../RobotWorldSchema";
import { IModelTestUtils } from "./Utils";

describe("RobotWorld", () => {
  it("should run robotworld", async () => {
    await RobotWorldEngine.initialize();

    const iModelFile = IModelTestUtils.prepareOutputFile("should-run-robotworld.bim");
    const seedFile = IModelTestUtils.resolveAssetFile("empty.bim");
    IModelJsFs.copySync(seedFile, iModelFile);
    const iModel = StandaloneDb.openFile(iModelFile, OpenMode.ReadWrite);
    assert.isTrue(iModel !== undefined);

    try {
      RobotWorldEngine.countRobots(iModel);
      assert.fail("RobotWorldEngine.countRobots should throw because the schema is not loaded yet");
    } catch (err) {
      // expect countRobots to fail
    }

    await RobotWorld.importSchema(iModel);
    iModel.saveChanges();

    assert.equal(RobotWorldEngine.countRobots(iModel), 0, "no Robots should be found in the empty iModel at first");

    const modelId: Id64String = PhysicalModel.insert(iModel, IModel.rootSubjectId, "RobotWorld");

    //  Initial placement: Robot1 is not touching any barrier (or other robot)
    //
    //  |
    //  |<---barrier1------->
    //  |                   ^
    //  |                   |
    //  |                   barrier2
    //  |                   |
    //  |R1                 V
    //  +-- -- -- -- -- -- --
    const robot1Id = RobotWorldEngine.insertRobot(iModel, modelId, "r1", Point3d.create(0, 0, 0));
    const barrier1Id = RobotWorldEngine.insertBarrier(iModel, modelId, Point3d.create(0, 5, 0), Angle.createDegrees(0), 5);
    const barrier2Id = RobotWorldEngine.insertBarrier(iModel, modelId, Point3d.create(5, 0, 0), Angle.createDegrees(90), 5);
    iModel.saveChanges();

    const barrier1 = iModel.elements.getElement<Barrier>(barrier1Id);
    /* const barrier2 = */
    iModel.elements.getElement<Barrier>(barrier2Id);

    assert.equal(RobotWorldEngine.countRobots(iModel), 1);

    const hits0 = RobotWorldEngine.queryObstaclesHitByRobot(iModel, robot1Id);
    assert.equal(hits0.length, 0, "no collisions initially");

    //  Move Robot1 up, so that it touches barrier1 but not barrier2
    //
    //  |
    //  |<---barrier1------->
    //  |R1                 ^
    //  |                   |
    //  |                   barrier2
    //  |                   |
    //  |                   V
    //  +-- -- -- -- -- -- --
    if (true) {
      RobotWorldEngine.moveRobot(iModel, robot1Id, barrier1.placement.origin);
      iModel.saveChanges();
      assert.deepEqual(iModel.elements.getElement<Robot>(robot1Id).placement.origin, barrier1.placement.origin);
      const barriersHit = RobotWorldEngine.queryObstaclesHitByRobot(iModel, robot1Id);
      assert.equal(barriersHit.length, 1, "expect a collision");
      assert.deepEqual(barriersHit[0], barrier1.id.toString());
    }

    iModel.saveChanges();
    iModel.close();

    await RobotWorldEngine.shutdown();
  });
});
