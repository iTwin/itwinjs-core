/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { BisCore } from "../BisCore";
import { PhysicalElement } from "../Element";
import { ElementMultiAspect, ElementUniqueAspect } from "../ElementAspect";
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
    const element = await iModel.elements.getElement(new Id64("0x17"));
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspect1 = await element.getUniqueAspect("DgnPlatformTest.TestUniqueAspectNoHandler");
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1.schemaName, "DgnPlatformTest");
    assert.equal(aspect1.className, "TestUniqueAspectNoHandler");
    assert.equal(aspect1.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1.length, 1);
    assert.isTrue(Object.isFrozen(aspect1));

    const aspect2 = await element.getUniqueAspect("DgnPlatformTest.TestUniqueAspect");
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2.schemaName, "DgnPlatformTest");
    assert.equal(aspect2.className, "TestUniqueAspect");
    assert.equal(aspect2.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isNull(aspect2.length);
    assert.isTrue(Object.isFrozen(aspect2));

    const multiAspectsA: ElementMultiAspect[] = await element.getMultiAspects("DgnPlatformTest.TestMultiAspectNoHandler");
    assert.exists(multiAspectsA);
    assert.isArray(multiAspectsA);
    assert.equal(multiAspectsA.length, 2);
    multiAspectsA.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.testMultiAspectProperty);
      assert.isTrue(Object.isFrozen(aspect));
    });

    const multiAspectsB: ElementMultiAspect[] = await element.getMultiAspects("DgnPlatformTest.TestMultiAspect");
    assert.exists(multiAspectsB);
    assert.isArray(multiAspectsB);
    assert.equal(multiAspectsB.length, 2);
    multiAspectsB.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspect");
      assert.exists(aspect.testMultiAspectProperty);
      assert.isTrue(Object.isFrozen(aspect));
    });

    let numErrorsCaught = 0;
    const rootSubject = await iModel.elements.getRootSubject();

    try {
      await rootSubject.getUniqueAspect("DgnPlatformTest.TestUniqueAspect");
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      numErrorsCaught++;
      assert.isTrue(error instanceof Error);
    }

    try {
      await rootSubject.getMultiAspects("DgnPlatformTest.TestMultiAspect");
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      numErrorsCaught++;
      assert.isTrue(error instanceof Error);
    }

    assert.equal(numErrorsCaught, 2);
  });
});
