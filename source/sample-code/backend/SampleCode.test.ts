/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BisCore, Element, InformationPartitionElement, IModelDb, ConcurrencyControl, ECSqlStatement } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { ElementProps, AxisAlignedBox3d, CodeSpec, CodeScopeSpec, DbResult, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients/lib/Token";

/** Sample code organized as tests to make sure that it builds and runs successfully. */
describe("Sample Code", () => {
  let iModel: IModelDb;
  let accessToken: AccessToken;

  before(async () => {
    iModel = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    accessToken = await IModelTestUtils.getTestUserAccessToken();
  });

  after(() => {
    iModel.close(accessToken);
  });

  /** Gives sample code something to call. */
  const doSomethingWithString = (s: string) => {
    assert.exists(s);
  };

  // __PUBLISH_EXTRACT_START__ IModelDbModels.createModel
  function createNewModel(parentElement: Element, modelName: string, isModelPrivate: boolean): Id64 {

    const outputImodel = parentElement.iModel;

    // The modeled element's code
    const modelCode = InformationPartitionElement.createCode(parentElement, modelName);

    //  The modeled element
    const modeledElementProps: ElementProps = {
      classFullName: "BisCore:PhysicalPartition",
      iModel: outputImodel,
      parent: { id: parentElement.id, relClassName: "BisCore:SubjectOwnsPartitionElements" },
      model: iModel.models.repositoryModelId,
      code: modelCode,
    };
    const modeledElement: Element = outputImodel.elements.createElement(modeledElementProps);
    const modeledElementId: Id64 = outputImodel.elements.insertElement(modeledElement);

    // The model
    const newModel = outputImodel.models.createModel({ modeledElement: modeledElementId, classFullName: "BisCore:PhysicalModel", isPrivate: isModelPrivate });
    const newModelId = outputImodel.models.insertModel(newModel);
    assert.isTrue(newModelId.isValid());

    return modeledElementId;
  }
  // __PUBLISH_EXTRACT_END__

  it("should update the imodel project extents", async () => {
    // __PUBLISH_EXTRACT_START__ IModelDb.updateProjectExtents
    // This is an example of how to expand an iModel's project extents.
    const originalExtents = iModel.projectExtents;
    const newExtents = new AxisAlignedBox3d(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50; newExtents.low.y -= 25; newExtents.low.z -= 189;
    newExtents.high.x += 1087; newExtents.high.y += 19; newExtents.high.z += .001;
    iModel.updateProjectExtents(newExtents);
    // __PUBLISH_EXTRACT_END__
  });

  it("should extract working sample code", async () => {
    // __PUBLISH_EXTRACT_START__ BisCore1.sampleCode
    // Register any schemas that will be used directly
    BisCore.registerSchema();

    // Get the class for the specified class name
    const elementClass = BisCore.getClass(Element.name, iModel);
    if (elementClass === undefined) {
      assert.fail();
      return;
    }

    // Do something with the returned element class
    doSomethingWithString(elementClass.schema.name);
    doSomethingWithString(elementClass.name);
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ ConcurrencyControl.setPolicy
    // Turn on optimistic concurrency control.
    // This allows the app to modify elements, models, etc. without first acquiring locks.
    // Later, when the app downloads and merges changeSets from iModelHub,
    // IModelDb's ConcurrencyControl will merge changes and handle conflicts,
    // as specified by this policy.
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ ConcurrencyControl_Codes.reserve
    try {
      await iModel.concurrencyControl.codes.reserve(accessToken);
    } catch (err) {
      if (err instanceof ConcurrencyControl.RequestError) {
        // Do something about err.unavailableCodes ...
      }
    }
    // __PUBLISH_EXTRACT_END__

    // Create a modeled element and a model.
    const newModeledElementId = createNewModel(iModel.elements.getRootSubject(), "newModelCode", false);

    // __PUBLISH_EXTRACT_START__ ConcurrencyControl.request
    // Now acquire all locks and reserve all codes needed.
    // This is a *prequisite* to saving local changes.
    try {
      await iModel.concurrencyControl.request(accessToken);
    } catch (err) {
      // If we can't get *all* of the locks and codes that are needed,
      // then we can't go on with this transaction as is.
      // We could possibly make additional changes to remove the need
      // for the resources that are unavailable. In this case,
      // we will just bail out and print a message.
      iModel.abandonChanges();
      // report error ...
    }
    // Now we can commit the local changes to a local transaction in the
    // IModelDb.
    // __PUBLISH_EXTRACT_END__

    // Now we can commit the local changes to a local transaction in the
    // IModelDb.
    iModel.saveChanges("inserted generic objects");

    assert.isTrue(newModeledElementId !== undefined);

    // assertions to ensure sample code is working properly
    assert.equal(BisCore.name, elementClass.schema.name);
    assert.equal(Element.name, elementClass.name);
  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = iModel;

    // __PUBLISH_EXTRACT_START__ CodeSpecs.insert
    // Create and insert a new CodeSpec with the name "CodeSpec1". In this example, we choose to make a model-scoped CodeSpec.
    const codeSpec: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId: Id64 = testImodel.codeSpecs.insert(codeSpec);
    assert.deepEqual(codeSpecId, codeSpec.id);

    // Should not be able to insert a duplicate.
    try {
      const codeSpecDup: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec1", CodeScopeSpec.Type.Model);
      testImodel.codeSpecs.insert(codeSpecDup); // throws in case of error
      assert.fail();
    } catch (err) {
      // We expect this to fail.
    }

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec2Id: Id64 = testImodel.codeSpecs.insert(codeSpec2);
    assert.deepEqual(codeSpec2Id, codeSpec2.id);
    assert.notDeepEqual(codeSpec2Id, codeSpecId);
    // __PUBLISH_EXTRACT_END__

  });

  it("should demonstrate ECSqlStatements", () => {
    const expectedEid = createNewModel(iModel.elements.getRootSubject(), "CodeValue1", false);

    // __PUBLISH_EXTRACT_START__ ECSqlStatement.Examples
    // Look up an element's ID by its CodeValue.
    // Note that the statement is general way, so that it can be cached and possibly reused.
    // A placeholder is used to represent the particular CodeValue that we want to look up.
    const eidFound: string = iModel.withPreparedStatement("SELECT ECInstanceId FROM BisCore.Element WHERE (CodeValue=?)", (stmt: ECSqlStatement) => {
      // Bind the particular CodeValue string that we care about to the statement.
      // Note that bindings begin with index 1.
      stmt.bindString(1, "CodeValue1");
      // Step the statement to get the first result.
      const res = stmt.step();
      // If no element has this CodeValue, indicate an error by throwing an exception.
      if (DbResult.BE_SQLITE_ROW !== res)
        throw new IModelError(IModelStatus.NotFound);
      // If an element was found, return its ID.
      // Note that results begin with index 0.
      // Note that IDs are returned as strings by ECSql. Even though I call getId,
      // the return value will be a string. It will be a formatted hex value.
      return stmt.getValue(0).getId();
    });

    // Check that we got the element that we expected.
    // Note that since the Id was returned by ECSql as a string, I must convert
    // it to an Id64 before using it.
    assert.deepEqual(new Id64(eidFound), expectedEid);
    // __PUBLISH_EXTRACT_END__
  });

});
