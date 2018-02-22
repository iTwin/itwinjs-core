/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BisCore } from "../BisCore";
import { Element, InformationPartitionElement } from "../Element";
import { IModelDb, ConcurrencyControl } from "../IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import { ElementProps } from "../../common/ElementProps";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
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
    IModelTestUtils.closeIModel(iModel);
  });

  /** Gives sample code something to call. */
  const doSomethingWithString = (s: string) => {
    assert.exists(s);
  };

  // __PUBLISH_EXTRACT_START__ BisCore1.sampleCreateModel
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

    return newModelId;
  }
  // __PUBLISH_EXTRACT_END__

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

    // __PUBLISH_EXTRACT_START__ BisCore1.sampleSetPolicy
    // Turn on optimistic concurrency control.
    // This allows the app to modify elements, models, etc. without first acquiring locks.
    // Later, when the app downloads and merges changeSets from iModelHub,
    // IModelDb's ConcurrencyControl will merge changes and handle conflicts,
    // as specified by this policy.
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ BisCore1.sampleReserveCodesWithErrorHandling
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

    // __PUBLISH_EXTRACT_START__ BisCore1.sampleConcurrencyControlRequest
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
    iModel.saveChanges("inserted generic objects");

    // __PUBLISH_EXTRACT_END__
    assert.isTrue(newModeledElementId !== undefined);

    // assertions to ensure sample code is working properly
    assert.equal(BisCore.name, elementClass.schema.name);
    assert.equal(Element.name, elementClass.name);
  });

});
