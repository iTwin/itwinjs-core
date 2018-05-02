"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chai_1 = require("chai");
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
const IModelTestUtils_1 = require("./IModelTestUtils");
const imodeljs_common_1 = require("@bentley/imodeljs-common");
const bentleyjs_core_1 = require("@bentley/bentleyjs-core");
/** Sample code organized as tests to make sure that it builds and runs successfully. */
describe("Sample Code", () => {
    let iModel;
    let accessToken;
    before(async () => {
        iModel = IModelTestUtils_1.IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
        accessToken = await IModelTestUtils_1.IModelTestUtils.getTestUserAccessToken();
    });
    after(() => {
        iModel.close(accessToken);
    });
    /** Gives sample code something to call. */
    const doSomethingWithString = (s) => {
        chai_1.assert.exists(s);
    };
    // __PUBLISH_EXTRACT_START__ IModelDbModels.createModel
    function createNewModel(parentElement, modelName, isModelPrivate) {
        const outputImodel = parentElement.iModel;
        // The modeled element's code
        const modelCode = imodeljs_backend_1.InformationPartitionElement.createCode(parentElement, modelName);
        //  The modeled element
        const modeledElementProps = {
            classFullName: "BisCore:PhysicalPartition",
            iModel: outputImodel,
            parent: { id: parentElement.id, relClassName: "BisCore:SubjectOwnsPartitionElements" },
            model: imodeljs_common_1.IModel.repositoryModelId,
            code: modelCode,
        };
        const modeledElement = outputImodel.elements.createElement(modeledElementProps);
        const modeledElementId = outputImodel.elements.insertElement(modeledElement);
        // The model
        const newModel = outputImodel.models.createModel({ modeledElement: modeledElementId, classFullName: "BisCore:PhysicalModel", isPrivate: isModelPrivate });
        const newModelId = outputImodel.models.insertModel(newModel);
        chai_1.assert.isTrue(newModelId.isValid());
        return modeledElementId;
    }
    // __PUBLISH_EXTRACT_END__
    it("should update the imodel project extents", async () => {
        // __PUBLISH_EXTRACT_START__ IModelDb.updateProjectExtents
        // This is an example of how to expand an iModel's project extents.
        const originalExtents = iModel.projectExtents;
        const newExtents = new imodeljs_common_1.AxisAlignedBox3d(originalExtents.low, originalExtents.high);
        newExtents.low.x -= 50;
        newExtents.low.y -= 25;
        newExtents.low.z -= 189;
        newExtents.high.x += 1087;
        newExtents.high.y += 19;
        newExtents.high.z += .001;
        iModel.updateProjectExtents(newExtents);
        // __PUBLISH_EXTRACT_END__
    });
    it("should extract working sample code", async () => {
        // __PUBLISH_EXTRACT_START__ BisCore1.sampleCode
        // Register any schemas that will be used directly
        imodeljs_backend_1.BisCore.registerSchema();
        // Get the class for the specified class name
        const elementClass = imodeljs_backend_1.BisCore.getClass(imodeljs_backend_1.Element.name, iModel);
        if (elementClass === undefined) {
            chai_1.assert.fail();
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
        iModel.concurrencyControl.setPolicy(new imodeljs_backend_1.ConcurrencyControl.OptimisticPolicy());
        // __PUBLISH_EXTRACT_END__
        // __PUBLISH_EXTRACT_START__ ConcurrencyControl_Codes.reserve
        try {
            await iModel.concurrencyControl.codes.reserve(accessToken);
        }
        catch (err) {
            if (err instanceof imodeljs_backend_1.ConcurrencyControl.RequestError) {
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
        }
        catch (err) {
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
        chai_1.assert.isTrue(newModeledElementId !== undefined);
        // assertions to ensure sample code is working properly
        chai_1.assert.equal(imodeljs_backend_1.BisCore.name, elementClass.schema.name);
        chai_1.assert.equal(imodeljs_backend_1.Element.name, elementClass.name);
    });
    it("should create and insert CodeSpecs", () => {
        const testImodel = iModel;
        // __PUBLISH_EXTRACT_START__ CodeSpecs.insert
        // Create and insert a new CodeSpec with the name "CodeSpec1". In this example, we choose to make a model-scoped CodeSpec.
        const codeSpec = new imodeljs_common_1.CodeSpec(testImodel, new bentleyjs_core_1.Id64(), "CodeSpec1", 2 /* Model */);
        const codeSpecId = testImodel.codeSpecs.insert(codeSpec);
        chai_1.assert.deepEqual(codeSpecId, codeSpec.id);
        // Should not be able to insert a duplicate.
        try {
            const codeSpecDup = new imodeljs_common_1.CodeSpec(testImodel, new bentleyjs_core_1.Id64(), "CodeSpec1", 2 /* Model */);
            testImodel.codeSpecs.insert(codeSpecDup); // throws in case of error
            chai_1.assert.fail();
        }
        catch (err) {
            // We expect this to fail.
        }
        // We should be able to insert another CodeSpec with a different name.
        const codeSpec2 = new imodeljs_common_1.CodeSpec(testImodel, new bentleyjs_core_1.Id64(), "CodeSpec2", 2 /* Model */, 2 /* FederationGuid */);
        const codeSpec2Id = testImodel.codeSpecs.insert(codeSpec2);
        chai_1.assert.deepEqual(codeSpec2Id, codeSpec2.id);
        chai_1.assert.notDeepEqual(codeSpec2Id, codeSpecId);
        // __PUBLISH_EXTRACT_END__
    });
});
//# sourceMappingURL=SampleCode.test.js.map