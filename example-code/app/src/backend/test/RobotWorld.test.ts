/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelDb } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./Utils";
import { RobotWorldEngine } from "../RobotWorldEngine";
import { RobotWorld } from "../RobotWorldSchema";
import { Point3d, Angle } from "@bentley/geometry-core";
import { Barrier } from "../BarrierElement";
import { Id64, OpenMode, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Robot } from "../RobotElement";

const actx = new ActivityLoggingContext("");

describe("RobotWorld", () => {
    it("should run robotworld", () => {
        RobotWorldEngine.initialize(actx);

        const iModel: IModelDb = IModelTestUtils.openIModel("empty.bim", { copyFilename: "should-run-robotworld.bim", deleteFirst: true, openMode: OpenMode.ReadWrite });
        assert.isTrue(iModel !== undefined);

        try {
            RobotWorldEngine.countRobots(iModel);
            assert.fail("RobotWorldEngine.countRobots should throw because the schema is not loaded yet");
        } catch (err) {
            // expect countRobots to fail
        }

        RobotWorld.importSchema(actx, iModel);
        iModel.saveChanges();

        assert.equal(RobotWorldEngine.countRobots(iModel), 0, "no Robots should be found in the empty iModel at first");

        const modelId: Id64 = IModelTestUtils.createNewModel(iModel.elements.getRootSubject(), "RobotWorld", false);

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

        const barrier1 = iModel.elements.getElement(barrier1Id) as Barrier;
        /* const barrier2 = */
        iModel.elements.getElement(barrier2Id) as Barrier;

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
            assert.deepEqual((iModel.elements.getElement(robot1Id) as Robot).placement.origin, barrier1.placement.origin);
            const barriersHit = RobotWorldEngine.queryObstaclesHitByRobot(iModel, robot1Id);
            assert.equal(barriersHit.length, 1, "expect a collision");
            assert.deepEqual(barriersHit[0], barrier1.id.toString());
        }

        iModel.saveChanges();
        iModel.closeStandalone();

        RobotWorldEngine.shutdown();
    });
});
