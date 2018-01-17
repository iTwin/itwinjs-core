/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BisCore } from "../backend/BisCore";
import { Element, InformationPartitionElement } from "../backend/Element";
import { EntityCtor } from "../backend/Entity";
import { IModelDb, ConcurrencyControl } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import { ElementProps } from "../common/ElementProps";
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
      parent: { id: parentElement.id, relClass: "BisCore:SubjectOwnsPartitionElements" },
      model: iModel.models.repositoryModelId,
      id: new Id64(),
      code: modelCode,
    };
    const modeledElement: Element = outputImodel.elements.createElement(modeledElementProps);
    const modeledElementId: Id64 = outputImodel.elements.insertElement(modeledElement);

    // The model
    const newModel = outputImodel.models.createModel({ id: new Id64(), modeledElement: modeledElementId, classFullName: "BisCore:PhysicalModel", isPrivate: isModelPrivate });
    const newModelId = outputImodel.models.insertModel(newModel);

    return newModelId;
  }
  // __PUBLISH_EXTRACT_END__

  it("should extract working sample code", async () => {
    // __PUBLISH_EXTRACT_START__ BisCore1.sampleCode
    // Register any schemas that will be used directly
    BisCore.registerSchema();

    // Get the class constructor for the specified class name
    const elementClass: EntityCtor | undefined = BisCore.getClass(Element.name, iModel);
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
    iModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy({
      updateVsUpdate: ConcurrencyControl.OnConflict.RejectIncomingChange,
      updateVsDelete: ConcurrencyControl.OnConflict.AcceptIncomingChange,
      deleteVsUpdate: ConcurrencyControl.OnConflict.RejectIncomingChange,
    }));
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ BisCore1.sampleReserveCodesWithErrorHandling
    try {
      await iModel.concurrencyControl.codes.reserve(accessToken);
    } catch (err) {
      // *** TODO: deal with CodeReservationError
    }
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ BisCore1.sampleBulkOperation
    // Operations such as creating models and categories are best done in the scope of a "bulk operation".
    // IModelDb's ConcurrencyControl will figure out what locks and/or codes are needed.
    iModel.concurrencyControl.startBulkOperation();
    // Create a modeled element and a model.
    const newModeledElementId = createNewModel(iModel.elements.getRootSubject(), "newModelCode", false);
    // Now acquire all locks and reserve all codes needed. If this fails, then the transaction must be rolled back.
    try {
      await iModel.concurrencyControl.endBulkOperation(accessToken);
    } catch (err) {
      iModel.abandonChanges();
    }
    // __PUBLISH_EXTRACT_END__
    assert.isTrue(newModeledElementId !== undefined);

    // assertions to ensure sample code is working properly
    assert.equal(BisCore.name, elementClass.schema.name);
    assert.equal(Element.name, elementClass.name);
  });

});
