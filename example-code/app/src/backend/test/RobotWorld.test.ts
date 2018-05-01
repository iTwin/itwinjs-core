/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelDb } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./Utils";
import { RobotWorldEngine } from "../RobotWorldEngine";

describe("RobotWorld", () => {
  it("should run robotworld", () => {
    RobotWorldEngine.initialize();
    const iModel: IModelDb = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    assert.isTrue(iModel !== undefined);
    try {
      RobotWorldEngine.countRobots(iModel);
      assert.fail("RobotWorldEngine.countRobots should throw because the schema is not loaded yet");
    } catch (err) {
      // expect countRobots to fail
    }
    iModel.closeStandalone();
  });
});
