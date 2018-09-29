/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { ElementAspectProps } from "@bentley/imodeljs-common";
import { Element, PhysicalElement } from "../../Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect } from "../../ElementAspect";
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

    const aspect1: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestUniqueAspectNoHandler")[0];
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1.classFullName, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.equal(aspect1.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1.length, 1);

    const aspect2: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestUniqueAspect")[0];
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2.classFullName, "DgnPlatformTest:TestUniqueAspect");
    assert.equal(aspect2.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isUndefined(aspect2.length);

    const multiAspectsA: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestMultiAspectNoHandler");
    assert.exists(multiAspectsA);
    assert.isArray(multiAspectsA);
    assert.equal(multiAspectsA.length, 2);
    multiAspectsA.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.testMultiAspectProperty);
    });

    const multiAspectsB: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestMultiAspect");
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
      iModel.elements.getAspects(rootSubject.id, "DgnPlatformTest:TestUniqueAspect");
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      numErrorsCaught++;
      assert.isTrue(error instanceof Error);
    }

    try {
      iModel.elements.getAspects(rootSubject.id, "DgnPlatformTest:TestMultiAspect");
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      numErrorsCaught++;
      assert.isTrue(error instanceof Error);
    }

    assert.equal(numErrorsCaught, 2);
  });

  it("should be able to insert and delete MultiAspects", () => {
    const element: Element = iModel.elements.getElement(new Id64("0x17"));
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspectProps: ElementAspectProps = {
      classFullName: "DgnPlatformTest:TestMultiAspectNoHandler",
      element: { id: element.id },
      testMultiAspectProperty: "MultiAspectInsertTest1",
    };
    iModel.elements.insertAspect(aspectProps);

    let aspects: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isAtLeast(aspects.length, 1);
    const numAspects = aspects.length;

    iModel.elements.deleteAspect(aspects[0].id);
    aspects = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isTrue(numAspects === aspects.length + 1);
  });

  it("should be able to insert and delete UniqueAspects", () => {
    const element: Element = iModel.elements.getElement(new Id64("0x17"));
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspectProps: ElementAspectProps = {
      classFullName: "DgnPlatformTest:TestUniqueAspectNoHandler",
      element: { id: element.id },
      testMultiAspectProperty: "UniqueAspectInsertTest1",
    };
    iModel.elements.insertAspect(aspectProps);

    const aspects: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isTrue(aspects.length === 1);

    iModel.elements.deleteAspect(aspects[0].id);
    try {
      iModel.elements.getAspects(element.id, aspectProps.classFullName);
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      assert.isTrue(error instanceof Error);
    }
  });
});
