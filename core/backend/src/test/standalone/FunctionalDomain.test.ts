/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { ActivityLoggingContext, Guid, Id64 } from "@bentley/bentleyjs-core";
// import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Code, CodeSpec, CodeScopeSpec, FunctionalElementProps, IModel, InformationPartitionElementProps } from "@bentley/imodeljs-common";
import { BriefcaseManager, Functional, FunctionalModel, FunctionalPartition, IModelDb } from "../../backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Functional Domain", () => {
  const activityLoggingContext = new ActivityLoggingContext("");

  before(() => {
    // Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Warning);
    // Logger.setLevel("imodeljs-addon", LogLevel.Warning);
    // Logger.setLevel("imodeljs-backend", LogLevel.Warning);
    // Logger.setLevel("DgnCore", LogLevel.Warning);
    // Logger.setLevel("ECObjectsNative", LogLevel.Warning);
    // Logger.setLevel("ECDb", LogLevel.Warning);
  });

  it("should populate FunctionalModel", async () => {
    const iModelDb: IModelDb = IModelTestUtils.createStandaloneIModel("FunctionalTest.bim", {
      rootSubject: { name: "FunctionalTest", description: "Test of the Functional domain schema." },
      client: "Functional",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: new Guid(true),
    });

    // Import the Functional schema
    await Functional.importSchema(activityLoggingContext, iModelDb);
    Functional.registerSchema();
    iModelDb.saveChanges("Import Functional schema");

    BriefcaseManager.createStandaloneChangeSet(iModelDb.briefcase); // importSchema below will fail if this is not called to flush local changes

    await iModelDb.importSchema(activityLoggingContext, path.join(__dirname, "../assets/TestFunctional.ecschema.xml"));
    iModelDb.saveChanges("Import TestFunctional schema");

    const codeSpec = new CodeSpec(iModelDb, new Id64(), "Test Functional Elements", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(codeSpec.id.isValid);

    // Create and populate a FunctionalModel
    const partitionProps: InformationPartitionElementProps = {
      classFullName: FunctionalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: {
        id: IModel.rootSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      code: FunctionalPartition.createCode(iModelDb, IModel.rootSubjectId, "Test Functional Model"),
    };
    const partitionId: Id64 = iModelDb.elements.insertElement(partitionProps);
    assert.isTrue(partitionId.isValid);
    const model: FunctionalModel = iModelDb.models.createModel({
      classFullName: FunctionalModel.classFullName,
      modeledElement: { id: partitionId },
    }) as FunctionalModel;
    const modelId: Id64 = iModelDb.models.insertModel(model);
    assert.isTrue(modelId.isValid);

    const breakdownProps: FunctionalElementProps = {
      classFullName: "TestFunctional:Breakdown",
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Breakdown1" }),
    };
    const breakdownId: Id64 = iModelDb.elements.insertElement(breakdownProps);
    assert.isTrue(breakdownId.isValid);

    const componentProps: FunctionalElementProps = {
      classFullName: "TestFunctional:Component",
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Component1" }),
    };
    const componentId: Id64 = iModelDb.elements.insertElement(componentProps);
    assert.isTrue(componentId.isValid);

    iModelDb.saveChanges("Insert Functional elements");
    iModelDb.closeStandalone();
  });
});
