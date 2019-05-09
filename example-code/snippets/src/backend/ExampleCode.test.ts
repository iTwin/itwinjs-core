/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BisCoreSchema, ConcurrencyControl, Element, ElementAspect, IModelDb, PhysicalModel } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { ElementAspectProps, CodeSpec, CodeScopeSpec, IModel } from "@bentley/imodeljs-common";
import { Id64, Id64String, Logger, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { Range3d } from "@bentley/geometry-core";

/** Example code organized as tests to make sure that it builds and runs successfully. */
describe("Example Code", () => {
  let iModel: IModelDb;

  // tslint:prefer-const:false
  const accessToken: AccessToken = (AccessToken as any);
  const authorizedRequestContext = new AuthorizedClientRequestContext(accessToken);

  before(async () => {
    iModel = IModelTestUtils.openIModel("test.bim");
  });

  after(() => {
    iModel.closeStandalone();
  });

  // __PUBLISH_EXTRACT_START__ ClientRequestContext.asyncCallback
  //                                  Rule: A Promise-returning function takes an ClientRequestContext as an argument
  async function asyncFunctionCallsAsync(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();        // Rule: A Promise-returning function enters the ClientRequestContext on the first line.

    await new Promise((resolve) => {
      setTimeout(() => {
        requestContext.enter(); // Rule: Enter the client request context of the enclosing JavaScript scope in the callback.
        Logger.logTrace("cat", "callback invoked");
        resolve();
      }, 1);
    });
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ClientRequestContext.asyncCallback2
  function synchronousFunctionCallsAsync() {
    // This is an example of the rare case where a synchronous function invokes an async function and
    // the async callback emits logging messages. In this case, because the caller is synchronous, it must
    // access the current ClientRequestContext and assign it to a local variable.
    const requestContext = ClientRequestContext.current;        // Must hold a local reference for callback to use.
    setTimeout(() => {
      requestContext.enter(); // Rule: Enter the client request context of the enclosing JavaScript scope in the callback.
      Logger.logTrace("cat", "callback invoked");
    }, 1);
  }
  // __PUBLISH_EXTRACT_END__

  async function someAsync(_context: ClientRequestContext): Promise<void> { }
  // Rule: A Promise-returning function enters the ClientRequestContext on the first line.
  // __PUBLISH_EXTRACT_START__ ClientRequestContext.asyncMethod

  //                                Rule: A Promise-returning function takes an ClientRequestContext as an argument
  async function asyncMethodExample(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();

    try {
      await someAsync(requestContext); // Rule: Pass the ClientRequestContext to Promise-returning methods
      requestContext.enter();        // Rule: Enter the ClientRequestContext on the line after an await
      Logger.logTrace("cat", "promise resolved");
    } catch (_err) {
      requestContext.enter();        // Rule: Enter the ClientRequestContext in an async rejection
      Logger.logTrace("cat", "promise rejected");
    }

    // The same rules, using .then.catch instead of await + try/catch.
    someAsync(requestContext)          // Rule: Pass the ClientRequestContext to Promise-returning methods
      .then(() => {
        requestContext.enter();    // Rule: Enter the ClientRequestContext on the line of .then callback
        Logger.logTrace("cat", "promise resolved");
      })
      .catch((_err) => {
        requestContext.enter();    // Rule: Enter the ClientRequestContext in .catch callback
        Logger.logTrace("cat", "promise rejected");
      });

  }
  // __PUBLISH_EXTRACT_END__

  it("should handle ClientRequestContext in async callbacks", async () => {
    await asyncFunctionCallsAsync(new ClientRequestContext("abc"));
    await synchronousFunctionCallsAsync(); // tslint:disable-line:await-promise
    await asyncMethodExample(new ClientRequestContext("abc"));
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

    // Get the JavaScript class for the "Element" Bis Class
    const elementClass = BisCoreSchema.getClass("Element", iModel)!;
    assert.equal("BisCore", elementClass.schema.schemaName);
    assert.equal("Element", elementClass.className);
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
      await iModel.concurrencyControl.codes.reserve(authorizedRequestContext);
    } catch (err) {
      if (err instanceof ConcurrencyControl.RequestError) {
        // Do something about err.unavailableCodes ...
      }
    }
    // __PUBLISH_EXTRACT_END__

    // Create a modeled element and a model.
    const newModeledElementId = PhysicalModel.insert(iModel, IModel.rootSubjectId, "newModelCode");

    // __PUBLISH_EXTRACT_START__ ConcurrencyControl.request
    // Now acquire all locks and reserve all codes needed.
    // This is a *perquisite* to saving local changes.
    try {
      await iModel.concurrencyControl.request(authorizedRequestContext);
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

    // assertions to ensure example code is working properly
    assert.equal(BisCoreSchema.schemaName, elementClass.schema.schemaName);
    assert.equal(Element.name, elementClass.name);
  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = iModel;

    // __PUBLISH_EXTRACT_START__ CodeSpecs.insert
    // Create and insert a new CodeSpec with the name "CodeSpec1". In this example, we choose to make a model-scoped CodeSpec.
    const codeSpec: CodeSpec = new CodeSpec(testImodel, Id64.invalid, "CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId: Id64String = testImodel.codeSpecs.insert(codeSpec);
    assert.deepEqual(codeSpecId, codeSpec.id);

    // Should not be able to insert a duplicate.
    try {
      const codeSpecDup: CodeSpec = new CodeSpec(testImodel, Id64.invalid, "CodeSpec1", CodeScopeSpec.Type.Model);
      testImodel.codeSpecs.insert(codeSpecDup); // throws in case of error
      assert.fail();
    } catch (err) {
      // We expect this to fail.
    }

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2: CodeSpec = new CodeSpec(testImodel, Id64.invalid, "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
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
    const aspectProps: ElementAspectProps = {
      classFullName: "SomeDomain:SomeAspectClass",
      element: { id: elementId },
      stringProp: "s1",
      numberProp: 1,
    };
    iModel.elements.insertAspect(aspectProps);
    // __PUBLISH_EXTRACT_END__
  });

});
