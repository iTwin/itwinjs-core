/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BisCore } from "../BisCore";
import { PhysicalElement } from "../Element";
import { ElementUniqueAspect } from "../ElementAspect";
import { IModel } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";

describe("ElementAspect", () => {

  let iModel: IModel;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    // NOTE: see ElementAspectTests.PresentationRuleScenarios in DgnPlatform\Tests\DgnProject\NonPublished\ElementAspect_Test.cpp for how ElementAspectTest.bim was created
    iModel = await IModelTestUtils.openIModel("ElementAspectTest.bim", true);
    assert.exists(iModel);
  });

  after(() => {
    iModel.closeDgnDb();
  });

  it("should be able to get aspects from test file", async () => {
    const { result: element } = await iModel.elements.getElement({ id: "0x17" });
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const { result: aspect1 } = await element!.getUniqueAspect("DgnPlatformTest.TestUniqueAspectNoHandler");
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1!.className, "TestUniqueAspectNoHandler");
    assert.equal(aspect1!.schemaName, "DgnPlatformTest");
    assert.equal(aspect1!.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1!.length, 1);

    const { result: aspect2 } = await element!.getUniqueAspect("DgnPlatformTest.TestUniqueAspect");
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2!.className, "TestUniqueAspect");
    assert.equal(aspect2!.schemaName, "DgnPlatformTest");
    assert.equal(aspect2!.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isNull(aspect2!.length);
  });
});
