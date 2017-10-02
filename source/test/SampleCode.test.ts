/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BisCore } from "../BisCore";
import { Element } from "../Element";
import { EntityCtor } from "../Entity";
import { IModelDb } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";

/** Sample code organized as tests to make sure that it builds and runs successfully. */
describe("Sample Code", () => {
  let iModel: IModelDb;

  before(async () => {
    iModel = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(iModel);
  });

  /** Gives sample code something to call. */
  const doSomethingWithString = (s: string) => {
    assert.exists(s);
  };

  it("should extract working sample code", async () => {
    // __PUBLISH_EXTRACT_START__ BisCore1.sampleCode
    // Register any schemas that will be used directly
    BisCore.registerSchema();

    // Get the class constructor for the specified class name
    const elementClass: EntityCtor = await BisCore.getClass(Element.name, iModel);

    // Do something with the returned element class
    doSomethingWithString(elementClass.schema.name);
    doSomethingWithString(elementClass.name);
    // __PUBLISH_EXTRACT_END__

    // assertions to ensure sample code is working properly
    assert.equal(BisCore.name, elementClass.schema.name);
    assert.equal(Element.name, elementClass.name);
  });

});
