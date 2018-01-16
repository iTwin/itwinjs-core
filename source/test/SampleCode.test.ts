/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BisCore } from "../backend/BisCore";
import { Element } from "../backend/Element";
import { EntityCtor } from "../backend/Entity";
import { IModelDb, ConcurrencyControl } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";

/** Sample code organized as tests to make sure that it builds and runs successfully. */
describe("Sample Code", () => {
  let iModel: IModelDb;

  before(() => {
    iModel = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(iModel);
  });

  /** Gives sample code something to call. */
  const doSomethingWithString = (s: string) => {
    assert.exists(s);
  };

  it("should extract working sample code", () => {
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
      iModel.concurrencyControl.codes.reserve();
    } catch (err) {
      // *** TODO: deal with CodeReservationError
    }
    // __PUBLISH_EXTRACT_END__

    // assertions to ensure sample code is working properly
    assert.equal(BisCore.name, elementClass.schema.name);
    assert.equal(Element.name, elementClass.name);
  });

});
