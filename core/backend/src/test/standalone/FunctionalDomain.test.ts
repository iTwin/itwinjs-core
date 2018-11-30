/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { ActivityLoggingContext, DbResult, Guid, Id64String, Id64 } from "@bentley/bentleyjs-core";
import { Logger } from "@bentley/bentleyjs-core";
import { Code, CodeSpec, CodeScopeSpec, FunctionalElementProps, IModel } from "@bentley/imodeljs-common";
import { BriefcaseManager, ECSqlStatement, Functional, FunctionalModel, IModelDb, SqliteStatement } from "../../backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Functional Domain", () => {
  const activityLoggingContext = new ActivityLoggingContext("");

  before(() => {
    // Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Warning);
    // Logger.setLevel("FunctionalDomain.test", LogLevel.Info);
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
      guid: Guid.createValue(),
    });

    // Import the Functional schema
    await Functional.importSchema(activityLoggingContext, iModelDb);
    Functional.registerSchema();

    let commits = 0;
    let committed = 0;
    const dropCommit = iModelDb.txns.onCommit.addListener(() => commits++);
    const dropCommitted = iModelDb.txns.onCommitted.addListener(() => committed++);
    iModelDb.saveChanges("Import Functional schema");

    assert.equal(commits, 1);
    assert.equal(committed, 1);
    dropCommit();
    dropCommitted();

    BriefcaseManager.createStandaloneChangeSet(iModelDb.briefcase); // importSchema below will fail if this is not called to flush local changes

    await iModelDb.importSchema(activityLoggingContext, path.join(__dirname, "../assets/TestFunctional.ecschema.xml"));

    iModelDb.saveChanges("Import TestFunctional schema");
    assert.equal(commits, 1);
    assert.equal(committed, 1);

    const codeSpec = new CodeSpec(iModelDb, Id64.invalid, "Test Functional Elements", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));

    const modelId: Id64String = FunctionalModel.insert(iModelDb, IModel.rootSubjectId, "Test Functional Model");
    assert.isTrue(Id64.isValidId64(modelId));

    const breakdownProps: FunctionalElementProps = {
      classFullName: "TestFunctional:Breakdown",
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Breakdown1" }),
    };
    const breakdownId: Id64String = iModelDb.elements.insertElement(breakdownProps);
    assert.isTrue(Id64.isValidId64(breakdownId));

    const componentProps: FunctionalElementProps = {
      classFullName: "TestFunctional:Component",
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Component1" }),
    };
    const componentId: Id64String = iModelDb.elements.insertElement(componentProps);
    assert.isTrue(Id64.isValidId64(componentId));

    iModelDb.saveChanges("Insert Functional elements");

    iModelDb.withPreparedStatement("SELECT ECInstanceId AS id FROM ECDbMeta.ECSchemaDef WHERE Name='TestFunctional' LIMIT 1", (schemaStatement: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === schemaStatement.step()) {
        const schemaRow: any = schemaStatement.getRow();
        Logger.logInfo("FunctionalDomain.test", `${schemaRow.id}`);
        iModelDb.withPreparedStatement("SELECT ECInstanceId AS id FROM ECDbMeta.ECClassDef WHERE ECClassDef.Schema.Id=? AND Name='PlaceholderForSchemaHasBehavior' LIMIT 1", (classStatement: ECSqlStatement) => {
          classStatement.bindId(1, schemaRow.id);
          while (DbResult.BE_SQLITE_ROW === classStatement.step()) {
            const classRow: any = classStatement.getRow();
            Logger.logInfo("FunctionalDomain.test", `${classRow.id}`);
            iModelDb.withPreparedSqliteStatement("SELECT Id AS id, Instance AS xml FROM ec_CustomAttribute WHERE ClassId=? AND ContainerId=?", (customAttributeStatement: SqliteStatement) => {
              customAttributeStatement.bindValue(1, { id: classRow.id });
              customAttributeStatement.bindValue(2, { id: schemaRow.id });
              while (DbResult.BE_SQLITE_ROW === customAttributeStatement.step()) {
                const customAttributeRow: any = customAttributeStatement.getRow();
                Logger.logInfo("FunctionalDomain.test", `${customAttributeRow.id}, ${customAttributeRow.xml}`);
              }
            });
          }
        });
      }
    });

    iModelDb.closeStandalone();
  });
});
