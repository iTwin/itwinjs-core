/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Guid, Id64, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModel, InformationPartitionElementProps } from "@bentley/imodeljs-common";
import { Functional, FunctionalModel, FunctionalPartition, IModelDb } from "../../backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Functional Domain", () => {

  it.only("should populate FunctionalModel", async () => {
    const iModelDb: IModelDb = IModelTestUtils.createStandaloneIModel("FunctionalTest.bim", {
      rootSubject: { name: "FunctionalTest", description: "Test of the Functional domain schema." },
      client: "Functional",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: new Guid(true),
    });

    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Warning);
    Logger.setLevel("imodeljs-backend", LogLevel.Trace);
    Logger.setLevel("DgnCore", LogLevel.Trace);
    Logger.setLevel("ECObjectsNative", LogLevel.Trace);
    Logger.setLevel("ECDb", LogLevel.Trace);

    // Import the Functional schema
    // TODO: Waiting for BIS Schemas to be available as NPM packages
    await iModelDb.importSchema(path.join(__dirname, "../../../../../common/temp/node_modules/@bentley/imodeljs-native-platform-api/lib/@bentley/imodeljs-n_8-win32-x64/addon/Assets/ECSchemas/Domain/Functional.ecschema.xml"));
    Functional.registerSchema();
    iModelDb.saveChanges("Import Functional schema");

    await iModelDb.importSchema(path.join(__dirname, "../assets/TestFunctional.ecschema.xml"));
    iModelDb.saveChanges("Import TestFunctional schema");

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
    iModelDb.saveChanges("Insert Functional elements");
    iModelDb.closeStandalone();
  });
});
