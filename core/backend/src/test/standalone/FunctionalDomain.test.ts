/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import { Guid, Id64 } from "@bentley/bentleyjs-core";
import { Code, CodeScopeSpec, CodeSpec, FunctionalElementProps, IModel } from "@bentley/imodeljs-common";
import { BackendRequestContext, FunctionalModel, FunctionalSchema, Schemas, StandaloneDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Functional Domain", () => {
  const requestContext = new BackendRequestContext();

  it("should populate FunctionalModel", async () => {
    const iModelDb = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("FunctionalDomain", "FunctionalTest.bim"), {
      rootSubject: { name: "FunctionalTest", description: "Test of the Functional domain schema." },
      client: "Functional",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    iModelDb.nativeDb.resetBriefcaseId(100);

    const testSchema = class extends FunctionalSchema { public static get schemaName(): string { return "TestFunctional"; } };

    // Import the Functional schema
    FunctionalSchema.registerSchema();
    Schemas.registerSchema(testSchema);
    await FunctionalSchema.importSchema(requestContext, iModelDb); // eslint-disable-line deprecation/deprecation

    let commits = 0;
    let committed = 0;
    const dropCommit = iModelDb.txns.onCommit.addListener(() => commits++);
    const dropCommitted = iModelDb.txns.onCommitted.addListener(() => committed++);
    iModelDb.saveChanges("Import Functional schema");

    assert.equal(commits, 1);
    assert.equal(committed, 1);
    dropCommit();
    dropCommitted();

    IModelTestUtils.flushTxns(iModelDb); // importSchema below will fail if this is not called to flush local changes

    await iModelDb.importSchemas(requestContext, [path.join(__dirname, "../assets/TestFunctional.ecschema.xml")]);

    iModelDb.saveChanges("Import TestFunctional schema");
    assert.equal(commits, 1);
    assert.equal(committed, 1);

    const codeSpec = CodeSpec.create(iModelDb, "Test Functional Elements", CodeScopeSpec.Type.Model);
    iModelDb.codeSpecs.insert(codeSpec);
    assert.isTrue(Id64.isValidId64(codeSpec.id));

    const modelId = FunctionalModel.insert(iModelDb, IModel.rootSubjectId, "Test Functional Model");
    assert.isTrue(Id64.isValidId64(modelId));

    const breakdownProps: FunctionalElementProps = {
      classFullName: "TestFunctional:Breakdown",
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Breakdown1" }),
    };
    const breakdownId = iModelDb.elements.insertElement(breakdownProps);
    assert.isTrue(Id64.isValidId64(breakdownId));

    const componentProps: FunctionalElementProps = {
      classFullName: "TestFunctional:Component",
      model: modelId,
      code: new Code({ spec: codeSpec.id, scope: modelId, value: "Component1" }),
    };
    const componentId = iModelDb.elements.insertElement(componentProps);
    assert.isTrue(Id64.isValidId64(componentId));

    iModelDb.saveChanges("Insert Functional elements");

    // unregister test schema to make sure it will throw exceptions if it is not present (since it has the "SchemaHasBehavior" custom attribute)
    Schemas.unregisterSchema(testSchema.schemaName);
    const errMsg = "Schema [TestFunctional] not registered, but is marked with SchemaHasBehavior";
    expect(() => iModelDb.elements.deleteElement(breakdownId)).to.throw(errMsg);
    assert.isDefined(iModelDb.elements.getElement(breakdownId), "should not have been deleted");
    expect(() => iModelDb.elements.updateElement(breakdownProps)).to.throw(errMsg);
    breakdownProps.code.value = "Breakdown 2";
    expect(() => iModelDb.elements.insertElement(breakdownProps)).to.throw(errMsg);

    iModelDb.close();
  });
});
