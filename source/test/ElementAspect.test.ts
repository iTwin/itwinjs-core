/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BisCore } from "../BisCore";
import { PhysicalElement } from "../Element";
import { ElementMultiAspect, ElementUniqueAspect } from "../ElementAspect";
import { IModel } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";

BisCore.registerSchema();

describe("ElementAspect", () => {

  it("should be able to get aspects from test file", async () => {
    // NOTE: see ElementAspectTests.PresentationRuleScenarios in DgnPlatform\Tests\DgnProject\NonPublished\ElementAspect_Test.cpp for how ElementAspectTest.bim was created
    const iModel: IModel = await IModelTestUtils.openIModel("ElementAspectTest.bim", true);
    assert.exists(iModel);
    const { result: element } = await iModel.elements.getElement({ id: "0x17" });
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const { result: aspect1 } = await element!.getUniqueAspect("DgnPlatformTest.TestUniqueAspectNoHandler");
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1!.schemaName, "DgnPlatformTest");
    assert.equal(aspect1!.className, "TestUniqueAspectNoHandler");
    assert.equal(aspect1!.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1!.length, 1);
    assert.isTrue(Object.isFrozen(aspect1));

    const { result: aspect2 } = await element!.getUniqueAspect("DgnPlatformTest.TestUniqueAspect");
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2!.schemaName, "DgnPlatformTest");
    assert.equal(aspect2!.className, "TestUniqueAspect");
    assert.equal(aspect2!.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isNull(aspect2!.length);
    assert.isTrue(Object.isFrozen(aspect2));

    const responseA = await element!.getMultiAspects("DgnPlatformTest.TestMultiAspectNoHandler");
    assert.exists(responseA.result);
    assert.isArray(responseA.result);
    const multiAspectsA: ElementMultiAspect[] = responseA.result!;
    assert.equal(multiAspectsA.length, 2);
    multiAspectsA.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.testMultiAspectProperty);
      assert.isTrue(Object.isFrozen(aspect));
    });

    const responseB = await element!.getMultiAspects("DgnPlatformTest.TestMultiAspect");
    assert.exists(responseB.result);
    assert.isArray(responseB.result);
    const multiAspectsB: ElementMultiAspect[] = responseB.result!;
    assert.equal(multiAspectsB.length, 2);
    multiAspectsB.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspect");
      assert.exists(aspect.testMultiAspectProperty);
      assert.isTrue(Object.isFrozen(aspect));
    });
  });
});
