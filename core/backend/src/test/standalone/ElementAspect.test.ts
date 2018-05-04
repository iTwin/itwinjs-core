/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { PhysicalElement } from "../../Element";
import { ElementMultiAspect, ElementUniqueAspect } from "../../ElementAspect";
import { IModelDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("ElementAspect", () => {

  let iModel: IModelDb;

  before(() => {
    // NOTE: see ElementAspectTests.PresentationRuleScenarios in DgnPlatform\Tests\DgnProject\NonPublished\ElementAspect_Test.cpp for how ElementAspectTest.bim was created
    iModel = IModelTestUtils.openIModel("ElementAspectTest.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(iModel);
  });

  it("should be able to get aspects from test file", () => {
    const element = iModel.elements.getElement(new Id64("0x17"));
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspect1 = iModel.elements.getUniqueAspect(element.id, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1.classFullName, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.equal(aspect1.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1.length, 1);

    const aspect2 = iModel.elements.getUniqueAspect(element.id, "DgnPlatformTest:TestUniqueAspect");
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2.classFullName, "DgnPlatformTest:TestUniqueAspect");
    assert.equal(aspect2.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isUndefined(aspect2.length);

    const multiAspectsA: ElementMultiAspect[] = iModel.elements.getMultiAspects(element.id, "DgnPlatformTest:TestMultiAspectNoHandler");
    assert.exists(multiAspectsA);
    assert.isArray(multiAspectsA);
    assert.equal(multiAspectsA.length, 2);
    multiAspectsA.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.testMultiAspectProperty);
    });

    const multiAspectsB: ElementMultiAspect[] = iModel.elements.getMultiAspects(element.id, "DgnPlatformTest:TestMultiAspect");
    assert.exists(multiAspectsB);
    assert.isArray(multiAspectsB);
    assert.equal(multiAspectsB.length, 2);
    multiAspectsB.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspect");
      assert.exists(aspect.testMultiAspectProperty);
    });

    let numErrorsCaught = 0;
    const rootSubject = iModel.elements.getRootSubject();

    try {
      iModel.elements.getUniqueAspect(rootSubject.id, "DgnPlatformTest:TestUniqueAspect");
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      numErrorsCaught++;
      assert.isTrue(error instanceof Error);
    }

    try {
      iModel.elements.getMultiAspects(rootSubject.id, "DgnPlatformTest:TestMultiAspect");
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      numErrorsCaught++;
      assert.isTrue(error instanceof Error);
    }

    assert.equal(numErrorsCaught, 2);
  });
});
