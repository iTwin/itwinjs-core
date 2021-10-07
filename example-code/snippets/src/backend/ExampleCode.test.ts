/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { AccessToken, Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { BisCoreSchema, BriefcaseDb, ClassRegistry, Element, ElementAspect, PhysicalModel, StandaloneDb } from "@itwin/core-backend";
import { CodeScopeSpec, CodeSpec, IModel } from "@itwin/core-common";
import { IModelTestUtils } from "./IModelTestUtils";

/** Example code organized as tests to make sure that it builds and runs successfully. */
describe("Example Code", () => {
  let iModel: StandaloneDb;

  const accessToken: AccessToken = "";

  before(async () => {
    iModel = IModelTestUtils.openIModelForWrite("test.bim");
  });

  after(() => {
    iModel.close();
  });

  it("should update the imodel project extents", async () => {
    // __PUBLISH_EXTRACT_START__ IModelDb.updateProjectExtents
    // This is an example of how to expand an iModel's project extents.
    const originalExtents = iModel.projectExtents;
    const newExtents = Range3d.create(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50; newExtents.low.y -= 25; newExtents.low.z -= 189;
    newExtents.high.x += 1087; newExtents.high.y += 19; newExtents.high.z += .001;
    iModel.updateProjectExtents(newExtents);
    // __PUBLISH_EXTRACT_END__
  });

  it("should extract working example code", async () => {
    // __PUBLISH_EXTRACT_START__ BisCore.registerSchemaAndGetClass

    // Make sure somewhere in your startup code you call: IModelHost.startup()

    // Get the JavaScript class for the "Element" BIS Class
    const elementClass = ClassRegistry.findRegisteredClass("BisCore:Element")!;
    assert.equal("BisCore", elementClass.schema.schemaName);
    assert.equal("Element", elementClass.className);
    // __PUBLISH_EXTRACT_END__

    if (iModel.isBriefcase) {
      const briefcaseDb = iModel as any as BriefcaseDb; // just to eliminate all of the distracting if (iModel.isBriefcase) stuff from the code snippets

      // Make some local changes. In this example, we'll create a modeled element and a model.
      const newModeledElementId = PhysicalModel.insert(iModel, IModel.rootSubjectId, "newModelCode");
      assert.isTrue(newModeledElementId !== undefined);

      // If we do get the resources we need, we can commit the local changes to a local transaction in the IModelDb.
      briefcaseDb.saveChanges("inserted generic objects");

      // When all local changes are saved in the briefcase, we push them to the iModel server.
      await briefcaseDb.pushChanges({ accessToken, description: "comment" });
    }

    // assertions to ensure example code is working properly
    assert.equal(BisCoreSchema.schemaName, elementClass.schema.schemaName);
    assert.equal(Element.name, elementClass.name);
  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = iModel;

    // __PUBLISH_EXTRACT_START__ CodeSpecs.insert
    // Create and insert a new CodeSpec with the name "CodeSpec1". In this example, we choose to make a model-scoped CodeSpec.
    const codeSpec: CodeSpec = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId: Id64String = testImodel.codeSpecs.insert(codeSpec);
    assert.deepEqual(codeSpecId, codeSpec.id);

    // Should not be able to insert a duplicate.
    try {
      const codeSpecDup: CodeSpec = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
      testImodel.codeSpecs.insert(codeSpecDup); // throws in case of error
      assert.fail();
    } catch (err) {
      // We expect this to fail.
    }

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2: CodeSpec = CodeSpec.create(testImodel, "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec2Id: Id64String = testImodel.codeSpecs.insert(codeSpec2);
    assert.deepEqual(codeSpec2Id, codeSpec2.id);
    assert.notDeepEqual(codeSpec2Id, codeSpecId);
    // __PUBLISH_EXTRACT_END__

  });

  it.skip("ElementAspects", () => { // WIP: code example compiles, but doesn't actually work
    const elementId = Id64.invalid;
    const elementAspectClassFullName = "SomeDomain:SomeAspectClass";
    // __PUBLISH_EXTRACT_START__ Elements.getAspects
    const elementAspects: ElementAspect[] = iModel.elements.getAspects(elementId, elementAspectClassFullName);
    // __PUBLISH_EXTRACT_END__
    elementAspects;

    // __PUBLISH_EXTRACT_START__ Elements.insertAspect
    const aspectProps = {
      classFullName: "SomeDomain:SomeAspectClass",
      element: { id: elementId },
      stringProp: "s1",
      numberProp: 1,
    };
    iModel.elements.insertAspect(aspectProps);
    // __PUBLISH_EXTRACT_END__
  });

});
