/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { ElementAspectProps, ExternalSourceAspectProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import {
  Element, ElementAspect, ElementMultiAspect, ElementUniqueAspect, ExternalSourceAspect, PhysicalElement, SnapshotDb, SpatialCategory,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("ElementAspect", () => {

  let iModel: SnapshotDb;

  before(() => {
    // NOTE: see ElementAspectTests.PresentationRuleScenarios in DgnPlatform\Tests\DgnProject\NonPublished\ElementAspect_Test.cpp for how ElementAspectTest.bim was created
    const seedFileName = IModelTestUtils.resolveAssetFile("ElementAspectTest.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ElementAspect", "ElementAspectTest.bim");
    iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    iModel.close();
  });

  it("should be able to get aspects from test file", () => {
    const element = iModel.elements.getElement("0x17");
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspect1: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestUniqueAspectNoHandler")[0];
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1.classFullName, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.equal(aspect1.asAny.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1.asAny.length, 1);
    assert.equal(JSON.stringify(aspect1), `{"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"Aspect1-Updated","length":1,"element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}`);

    // Test getAspects with dot separator
    const aspect1DotSeparator: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest.TestUniqueAspectNoHandler")[0];
    assert.exists(aspect1DotSeparator);
    assert.isTrue(aspect1DotSeparator instanceof ElementUniqueAspect);
    assert.equal(aspect1DotSeparator.classFullName, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.equal(aspect1DotSeparator.asAny.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1DotSeparator.asAny.length, 1);
    assert.equal(JSON.stringify(aspect1DotSeparator), `{"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"Aspect1-Updated","length":1,"element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}`);

    // cross-check getAspects against getAspect
    const aspect1X: ElementAspect = iModel.elements.getAspect(aspect1.id);
    assert.exists(aspect1X);
    assert.isTrue(aspect1X instanceof ElementUniqueAspect);
    assert.equal(aspect1X.classFullName, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.equal(aspect1X.asAny.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1X.asAny.length, 1);
    assert.equal(JSON.stringify(aspect1X), `{"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"Aspect1-Updated","length":1,"element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}`);

    const aspect2: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestUniqueAspect")[0];
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2.classFullName, "DgnPlatformTest:TestUniqueAspect");
    assert.equal(aspect2.asAny.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isUndefined(aspect2.asAny.length);
    assert.equal(JSON.stringify(aspect2), `{"classFullName":"DgnPlatformTest:TestUniqueAspect","id":"0x1","testUniqueAspectProperty":"Aspect2-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}`);

    // Test getAspects with dot separator
    const aspect2DotSeparator: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest.TestUniqueAspect")[0];
    assert.exists(aspect2DotSeparator);
    assert.isTrue(aspect2DotSeparator instanceof ElementUniqueAspect);
    assert.equal(aspect2DotSeparator.classFullName, "DgnPlatformTest:TestUniqueAspect");
    assert.equal(aspect2DotSeparator.asAny.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isUndefined(aspect2DotSeparator.asAny.length);
    assert.equal(JSON.stringify(aspect2DotSeparator), `{"classFullName":"DgnPlatformTest:TestUniqueAspect","id":"0x1","testUniqueAspectProperty":"Aspect2-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}`);

    // cross-check getAspects against getAspect
    const aspect2X: ElementAspect = iModel.elements.getAspect(aspect2.id);
    assert.exists(aspect2X);
    assert.isTrue(aspect2X instanceof ElementUniqueAspect);
    assert.equal(aspect2X.classFullName, "DgnPlatformTest:TestUniqueAspect");
    assert.equal(aspect2X.asAny.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isUndefined(aspect2X.asAny.length);
    assert.equal(JSON.stringify(aspect2X), `{"classFullName":"DgnPlatformTest:TestUniqueAspect","id":"0x1","testUniqueAspectProperty":"Aspect2-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}`);

    const uniqueAspects: ElementUniqueAspect[] = iModel.elements.getAspects(element.id, ElementUniqueAspect.classFullName);
    assert.equal(uniqueAspects.length, 2);
    uniqueAspects.forEach((aspect) => {
      assert.isTrue(aspect.classFullName === aspect1.classFullName || aspect.classFullName === aspect2.classFullName);
      // cross-check against getting the aspects individually
      const aspectX: ElementAspect = iModel.elements.getAspect(aspect.id);
      assert.exists(aspectX);
      assert.equal(aspectX.schemaName, aspect.schemaName);
      assert.equal(aspectX.className, aspect.className);
    });
    assert.equal(JSON.stringify(uniqueAspects), `[{"classFullName":"DgnPlatformTest:TestUniqueAspect","id":"0x1","testUniqueAspectProperty":"Aspect2-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}},
    {"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"Aspect1-Updated","length":1,"element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}]`.replace(/\s+/g, ""));

    const multiAspectsA: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestMultiAspectNoHandler");
    assert.exists(multiAspectsA);
    assert.isArray(multiAspectsA);
    assert.equal(multiAspectsA.length, 2);
    multiAspectsA.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.asAny.testMultiAspectProperty);
      // cross-check against getting the aspects individually
      const aspectX: ElementAspect = iModel.elements.getAspect(aspect.id);
      assert.exists(aspectX);
      assert.equal(aspectX.schemaName, aspect.schemaName);
      assert.equal(aspectX.className, aspect.className);
      assert.exists(aspectX.asAny.testMultiAspectProperty);
      assert.equal(aspectX.asAny.testMultiAspectProperty, aspect.asAny.testMultiAspectProperty);
    });
    assert.equal(JSON.stringify(multiAspectsA), `[{"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}}]`.replace(/\s+/g, ""));

    // Test getAspects with dot separator
    const multiAspectsADotSeparator: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest.TestMultiAspectNoHandler");
    assert.exists(multiAspectsADotSeparator);
    assert.isArray(multiAspectsADotSeparator);
    assert.equal(multiAspectsADotSeparator.length, 2);
    multiAspectsADotSeparator.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.asAny.testMultiAspectProperty);
      // cross-check against getting the aspects individually
      const aspectX: ElementAspect = iModel.elements.getAspect(aspect.id);
      assert.exists(aspectX);
      assert.equal(aspectX.schemaName, aspect.schemaName);
      assert.equal(aspectX.className, aspect.className);
      assert.exists(aspectX.asAny.testMultiAspectProperty);
      assert.equal(aspectX.asAny.testMultiAspectProperty, aspect.asAny.testMultiAspectProperty);
    });
    assert.equal(JSON.stringify(multiAspectsADotSeparator), `[{"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}}]`.replace(/\s+/g, ""));

    const multiAspectsB: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestMultiAspect");
    assert.exists(multiAspectsB);
    assert.isArray(multiAspectsB);
    assert.equal(multiAspectsB.length, 2);
    multiAspectsB.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspect");
      assert.exists(aspect.asAny.testMultiAspectProperty);
      // cross-check against getting the aspects individually
      const aspectX: ElementAspect = iModel.elements.getAspect(aspect.id);
      assert.isTrue(aspectX instanceof ElementMultiAspect);
      assert.equal(aspectX.schemaName, "DgnPlatformTest");
      assert.equal(aspectX.className, "TestMultiAspect");
      assert.exists(aspectX.asAny.testMultiAspectProperty);
    });
    assert.equal(JSON.stringify(multiAspectsB), `[{"classFullName":"DgnPlatformTest:TestMultiAspect","id":"0x2","testMultiAspectProperty":"Aspect5-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspect","id":"0x3","testMultiAspectProperty":"Aspect6-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}}]`.replace(/\s+/g, ""));

    const multiAspects: ElementAspect[] = iModel.elements.getAspects(element.id, ElementMultiAspect.classFullName);
    assert.equal(multiAspects.length, 4);
    multiAspects.forEach((aspect) => {
      assert.isTrue(aspect.classFullName === multiAspectsA[0].classFullName || aspect.classFullName === multiAspectsB[0].classFullName);
      // cross-check against getting the aspects individually
      const aspectX: ElementAspect = iModel.elements.getAspect(aspect.id);
      assert.exists(aspectX);
      assert.equal(aspectX.schemaName, aspect.schemaName);
      assert.equal(aspectX.className, aspect.className);
    });
    assert.equal(JSON.stringify(multiAspects), `[{"classFullName":"DgnPlatformTest:TestMultiAspect","id":"0x2","testMultiAspectProperty":"Aspect5-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspect","id":"0x3","testMultiAspectProperty":"Aspect6-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}}]`.replace(/\s+/g, ""));

    const rootSubject = iModel.elements.getRootSubject();
    assert.equal(0, iModel.elements.getAspects(rootSubject.id, "DgnPlatformTest:TestUniqueAspect").length, "Don't expect DgnPlatformTest:TestUniqueAspect aspects on the root Subject");
    assert.equal(0, iModel.elements.getAspects(rootSubject.id, "DgnPlatformTest:TestMultiAspect").length, "Don't expect DgnPlatformTest:TestMultiAspect aspects on the root Subject");
    assert.equal(0, iModel.elements.getAspects(rootSubject.id).length, "Don't expect any aspects on the root Subject");

    // The 'Element' property is introduced by ElementUniqueAspect and ElementMultiAspect, but is not available at the ElementAspect base class.
    // Since we're now using instance queries to query ElementUniqueAspect and ElementMultiAspect directly in getAspects(), we can provide ElementAspect to the function as well.
    const aspectList = `[{"classFullName":"DgnPlatformTest:TestMultiAspect","id":"0x2","testMultiAspectProperty":"Aspect5-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspect","id":"0x3","testMultiAspectProperty":"Aspect6-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestUniqueAspect","id":"0x1","testUniqueAspectProperty":"Aspect2-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}},
    {"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"Aspect1-Updated","length":1,"element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}]`.replace(/\s+/g, "");

    const aspects: ElementAspect[] = iModel.elements.getAspects(element.id, ElementAspect.classFullName);
    assert.equal(aspects.length, 6);
    assert.equal(JSON.stringify(aspects), aspectList);

    const allAspects: ElementAspect[] = iModel.elements.getAspects(element.id);
    assert.equal(allAspects.length, 6);
    assert.equal(JSON.stringify(allAspects), aspectList);
  });

  it("should be able to insert, update, and delete MultiAspects", () => {
    const element: Element = iModel.elements.getElement("0x17");
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    interface Props extends ElementAspectProps { testMultiAspectProperty: string }
    const aspectProps: Props = {
      classFullName: "DgnPlatformTest:TestMultiAspectNoHandler",
      element: { id: element.id },
      testMultiAspectProperty: "MultiAspectInsertTest1",
    };
    iModel.elements.insertAspect(aspectProps);
    let aspects: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isAtLeast(aspects.length, 1);
    assert.equal(JSON.stringify(aspects), `[{"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x21","testMultiAspectProperty":"MultiAspectInsertTest1","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}}]`.replace(/\s+/g, ""));
    const numAspects = aspects.length;

    let found: boolean = false;
    let foundIndex: number = -1;
    for (const aspect of aspects) {
      foundIndex++;
      if (aspect.asAny.testMultiAspectProperty === aspectProps.testMultiAspectProperty) {
        found = true;
        break;
      }
    }
    assert.isTrue(found);

    aspects[foundIndex].asAny.testMultiAspectProperty = "MultiAspectInsertTest1-Updated";
    iModel.elements.updateAspect(aspects[foundIndex].toJSON());

    const aspectsUpdated: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.equal(aspectsUpdated.length, aspects.length);
    assert.equal(aspectsUpdated[foundIndex].asAny.testMultiAspectProperty, "MultiAspectInsertTest1-Updated");
    // Check if aspect was updated
    assert.equal(JSON.stringify(aspectsUpdated), `[{"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x21","testMultiAspectProperty":"MultiAspectInsertTest1-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsMultiAspects"}}]`.replace(/\s+/g, ""));

    iModel.elements.deleteAspect(aspects[foundIndex].id);
    aspects = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.equal(numAspects, aspects.length + 1);
    // Check if aspect was deleted
    assert.equal(JSON.stringify(aspects), `[{"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x4","testMultiAspectProperty":"Aspect3-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}},
    {"classFullName":"DgnPlatformTest:TestMultiAspectNoHandler","id":"0x5","testMultiAspectProperty":"Aspect4-Updated","element":{"id":"0x17","relClassName":"DgnPlatformTest.TestElement"}}]`.replace(/\s+/g, ""));
  });

  it("should be able to insert, update, and delete UniqueAspects", () => {
    const element: Element = iModel.elements.getElement("0x17");
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspectProps = {
      classFullName: "DgnPlatformTest:TestUniqueAspectNoHandler",
      element: { id: element.id },
      testUniqueAspectProperty: "UniqueAspectInsertTest1",
    };
    iModel.elements.insertAspect(aspectProps);
    const aspects: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isTrue(aspects.length === 1);
    assert.equal(aspects[0].asAny.testUniqueAspectProperty, aspectProps.testUniqueAspectProperty);
    assert.equal(JSON.stringify(aspects), `[{"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"UniqueAspectInsertTest1","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}]`);

    aspects[0].asAny.testUniqueAspectProperty = "UniqueAspectInsertTest1-Updated";
    iModel.elements.updateAspect(aspects[0].toJSON());
    const aspectsUpdated: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.equal(aspectsUpdated.length, 1);
    assert.equal(aspectsUpdated[0].asAny.testUniqueAspectProperty, "UniqueAspectInsertTest1-Updated");
    assert.equal(JSON.stringify(aspectsUpdated), `[{"classFullName":"DgnPlatformTest:TestUniqueAspectNoHandler","id":"0x6","testUniqueAspectProperty":"UniqueAspectInsertTest1-Updated","element":{"id":"0x17","relClassName":"BisCore.ElementOwnsUniqueAspect"}}]`);

    iModel.elements.deleteAspect(aspects[0].id);
    try {
      const noAspects = iModel.elements.getAspects(element.id, aspectProps.classFullName);
      assert.equal(noAspects.length, 0);
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      assert.isTrue(error instanceof Error);
    }
  });

  it("should be able to insert ExternalSourceAspects", () => {
    const fileName = IModelTestUtils.prepareOutputFile("ElementAspect", "ExternalSourceAspect.bim");
    let iModelDb = SnapshotDb.createEmpty(fileName, { rootSubject: { name: "ExternalSourceAspect" } });
    const elementId: Id64String = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "Category", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(elementId));

    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId },
      scope: { id: IModel.rootSubjectId },
      identifier: "A",
      kind: "Letter",
      checksum: "1",
      version: "1.0",
    };
    const aspect = new ExternalSourceAspect(aspectProps, iModelDb);
    expect(aspect).to.deep.subsetEqual(aspectProps, { normalizeClassNameProps: true });
    iModelDb.elements.insertAspect(aspectProps);

    const aspectJson = aspect.toJSON();
    iModelDb.saveChanges();
    iModelDb.close();
    iModelDb = SnapshotDb.openFile(fileName);

    const aspects: ElementAspect[] = iModelDb.elements.getAspects(elementId, aspectProps.classFullName);
    assert.equal(aspects.length, 1);
    assert.equal(JSON.stringify(aspects), `[{"classFullName":"BisCore:ExternalSourceAspect","id":"0x21","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"A","kind":"Letter","version":"1.0","checksum":"1","element":{"id":"0x11","relClassName":"BisCore.ElementOwnsMultiAspects"}}]`);
    expect(aspects[0]).to.deep.subsetEqual(aspectProps, { normalizeClassNameProps: true });

    expect(aspectJson).to.deep.subsetEqual(aspectProps, { normalizeClassNameProps: true });

    assert(aspectProps.scope !== undefined);
    const foundAspects = ExternalSourceAspect.findAllBySource(iModelDb, aspectProps.scope.id, aspectProps.kind, aspectProps.identifier);
    assert.equal(foundAspects.length, 1);
    const foundAspect = foundAspects[0];
    assert.equal(foundAspect.aspectId, aspects[0].id);
    assert.equal(foundAspect.elementId, aspect.element.id);
  });

  it("should be able to insert multiple ExternalSourceAspects", () => {
    const fileName = IModelTestUtils.prepareOutputFile("MultipleElementAspects", "ExternalSourceAspect.bim");
    let iModelDb = SnapshotDb.createEmpty(fileName, { rootSubject: { name: "MultipleExternalSourceAspects" } });
    const e1: Id64String = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "Category1", new SubCategoryAppearance());
    const e2: Id64String = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "Category2", new SubCategoryAppearance());

    const scopeId1 = IModel.rootSubjectId;
    const scopeId2 = e1;
    const kind = "Letter";
    const kind2 = "Kind2";

    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: "" },
      scope: { id: "" },
      identifier: "",
      kind,
    };
    const a: ExternalSourceAspectProps = { ...aspectProps, identifier: "A", scope: { id: scopeId1 } };
    const a2: ExternalSourceAspectProps = { ...aspectProps, identifier: "A", scope: { id: scopeId2 } };
    const b: ExternalSourceAspectProps = { ...aspectProps, identifier: "B", scope: { id: scopeId1 } };
    const c: ExternalSourceAspectProps = { ...aspectProps, identifier: "C", scope: { id: scopeId1 } };
    const ck2: ExternalSourceAspectProps = { ...aspectProps, identifier: "C", scope: { id: scopeId1 }, kind: kind2 };

    const e1AspectProps: Array<ExternalSourceAspectProps> = [
      { ...a, element: { id: e1 } },
      { ...a, element: { id: e1 } }, // add a second aspect "A" in scope1
      { ...a2, element: { id: e1 } }, // add "A" in scope2
      { ...b, element: { id: e1 } },
      { ...ck2, element: { id: e1 } },
    ];
    const e2AspectProps: Array<ExternalSourceAspectProps> = [
      { ...a, element: { id: e2 } }, // element2 also has an "A" in scope1
      { ...c, element: { id: e2 } },
    ];
    e1AspectProps.forEach((aspect) => iModelDb.elements.insertAspect(aspect));
    e2AspectProps.forEach((aspect) => iModelDb.elements.insertAspect(aspect));
    iModelDb.saveChanges();
    iModelDb.close();
    iModelDb = SnapshotDb.openFile(fileName);

    const equalProps = (aspect: ElementAspect, wantProps: ExternalSourceAspectProps): boolean => {
      return (aspect.element.id === wantProps.element.id)
        && (aspect.asAny.scope.id === wantProps.scope.id)
        && (aspect.asAny.scope.relClassName.endsWith("ElementScopesExternalSourceIdentifier"))
        && (aspect.asAny.identifier === wantProps.identifier)
        && (aspect.asAny.kind === wantProps.kind)
        && (aspect.asAny.checksum === wantProps.checksum)
        && (aspect.asAny.version === wantProps.version);
    };
    const findInProps = (have: ElementAspect, wantArray: Array<ExternalSourceAspectProps>): boolean => {
      return wantArray.find((want) => equalProps(have, want)) !== undefined;
    };

    const e1Aspects: ElementAspect[] = iModelDb.elements.getAspects(e1, aspectProps.classFullName);
    assert.equal(e1Aspects.length, e1AspectProps.length);
    e1Aspects.forEach((x) => {
      assert.isTrue(findInProps(x, e1AspectProps));
    });
    assert.equal(JSON.stringify(e1Aspects), `[{"classFullName":"BisCore:ExternalSourceAspect","id":"0x21","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"A","kind":"Letter","element":{"id":"0x11","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"BisCore:ExternalSourceAspect","id":"0x22","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"A","kind":"Letter","element":{"id":"0x11","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"BisCore:ExternalSourceAspect","id":"0x23","scope":{"id":"0x11","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"A","kind":"Letter","element":{"id":"0x11","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"BisCore:ExternalSourceAspect","id":"0x24","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"B","kind":"Letter","element":{"id":"0x11","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"BisCore:ExternalSourceAspect","id":"0x25","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"C","kind":"Kind2","element":{"id":"0x11","relClassName":"BisCore.ElementOwnsMultiAspects"}}]`.replace(/\s+/g, ""));

    const e2Aspects: ElementAspect[] = iModelDb.elements.getAspects(e2, aspectProps.classFullName);
    assert.equal(e2Aspects.length, e2AspectProps.length);
    e2Aspects.forEach((x) => {
      assert.isTrue(findInProps(x, e2AspectProps));
    });
    assert.equal(JSON.stringify(e2Aspects), `[{"classFullName":"BisCore:ExternalSourceAspect","id":"0x26","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"A","kind":"Letter","element":{"id":"0x13","relClassName":"BisCore.ElementOwnsMultiAspects"}},
    {"classFullName":"BisCore:ExternalSourceAspect","id":"0x27","scope":{"id":"0x1","relClassName":"BisCore.ElementScopesExternalSourceIdentifier"},"identifier":"C","kind":"Letter","element":{"id":"0x13","relClassName":"BisCore.ElementOwnsMultiAspects"}}]`.replace(/\s+/g, ""));

    const allA = ExternalSourceAspect.findAllBySource(iModelDb, scopeId1, kind, "A");
    assert.equal(allA.filter((x) => x.elementId === e1).length, 2, "there are two A's in scope 1 on e1");
    assert.equal(allA.filter((x) => x.elementId === e2).length, 1, "there is one A in scope 1 on e2");
    assert.equal(allA.length, 3);

    const allA2 = ExternalSourceAspect.findAllBySource(iModelDb, scopeId2, kind, "A");
    assert.equal(allA2.length, 1);
    assert.equal(allA2[0].elementId, e1, "there is one A in scope 2 on e1");

    const allB = ExternalSourceAspect.findAllBySource(iModelDb, scopeId1, kind, "B");
    assert.equal(allB.length, 1);
    assert.equal(allB[0].elementId, e1, "there is one B on e1");

    const allC = ExternalSourceAspect.findAllBySource(iModelDb, scopeId1, kind, "C");
    assert.equal(allC.length, 1);
    assert.equal(allC[0].elementId, e2, "there is one C of kind1 on e2");

    const allCK2 = ExternalSourceAspect.findAllBySource(iModelDb, scopeId1, kind2, "C");
    assert.equal(allCK2.length, 1);
    assert.equal(allCK2[0].elementId, e1, "there is one C of kind 2 on e1");

    assert.equal(ExternalSourceAspect.findAllBySource(iModelDb, scopeId1, kind, "<notfound>").length, 0);
  });

});
