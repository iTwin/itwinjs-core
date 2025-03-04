/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import {
  BisCodeSpec,
  CodeScopeSpec,
  CodeSpec,
  IModelError,
} from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";
import { IModelStatus } from "@itwin/core-bentley";

describe("CodeSpecs", async () => {
  let iModel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    iModel = await TestSnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    if (iModel) {
      await iModel.close();
    }
    await TestUtility.shutdownFrontend();
  });

  const existing = {
    name: BisCodeSpec.subject,
    id: "0x1f",
  };

  /** verify that given codespec has expected properties */
  function verifyCodeSpec(
    codeSpec: CodeSpec,
    requestedIModel: IModelConnection,
    requestedName: string,
    requestedId: string
  ) {
    expect(codeSpec).to.exist;

    expect(codeSpec.id).to.exist;
    expect(codeSpec.id).to.equal(requestedId);

    expect(codeSpec.name).to.exist;
    expect(codeSpec.name).to.equal(requestedName);

    expect(codeSpec.iModel).to.exist;
    expect(codeSpec.iModel.name).to.equal(requestedIModel.name);
  }

  it("should load CodeSpecs", async () => {
    const nullCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(
      BisCodeSpec.nullCodeSpec
    );
    assert.equal(nullCodeSpec.scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(
      nullCodeSpec.scopeReq,
      CodeScopeSpec.ScopeRequirement.ElementId
    );

    const subCategoryCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(
      BisCodeSpec.subCategory
    );
    assert.equal(
      subCategoryCodeSpec.scopeType,
      CodeScopeSpec.Type.ParentElement
    );
    assert.equal(
      subCategoryCodeSpec.scopeReq,
      CodeScopeSpec.ScopeRequirement.ElementId
    );

    const viewDefinitionCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(
      BisCodeSpec.viewDefinition
    );
    assert.equal(viewDefinitionCodeSpec.scopeType, CodeScopeSpec.Type.Model);
    assert.equal(
      viewDefinitionCodeSpec.scopeReq,
      CodeScopeSpec.ScopeRequirement.ElementId
    );
  });

  it("should return code spec by name", async () => {
    const codeSpecName = existing.name;
    const codeSpecId = existing.id;

    const codeSpec = await iModel.codeSpecs.getByName(codeSpecName);

    verifyCodeSpec(codeSpec, iModel, codeSpecName, codeSpecId);
  });

  it("should return code spec by id", async () => {
    const codeSpecName = existing.name;
    const codeSpecId = existing.id;

    const codeSpec = await iModel.codeSpecs.getById(codeSpecId);

    verifyCodeSpec(codeSpec, iModel, codeSpecName, codeSpecId);
  });

  it("should fail because empty id", async () => {
    const codeSpecId = "";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    } catch (error: any) {
      expect(error).to.be.instanceOf(IModelError);
      expect(error.errorNumber).to.equal(IModelStatus.NotFound);
      expect(error.message).to.equal("CodeSpec not found");
    }
  });

  it("should fail because empty name", async () => {
    const codeSpecName = "";

    try {
      await iModel.codeSpecs.getByName(codeSpecName);
    } catch (error: any) {
      expect(error).to.be.instanceOf(IModelError);
      expect(error.errorNumber).to.equal(IModelStatus.NotFound);
      expect(error.message).to.equal("CodeSpec not found");
    }
  });

  it("should fail because invalid id", async () => {
    const codeSpecId = "0";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    } catch (error: any) {
      expect(error).to.be.instanceOf(IModelError);
      expect(error.errorNumber).to.equal(IModelStatus.InvalidId);
      expect(error.message).to.equal("Invalid codeSpecId");
      expect(error.getMetaData).to.be.a("function");
      expect(error.getMetaData()).to.deep.equal({ codeSpecId });
    }
  });

  it("should fail because non existent id", async () => {
    const codeSpecId = "0xff";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    } catch (error: any) {
      expect(error).to.be.instanceOf(IModelError);
      expect(error.errorNumber).to.equal(IModelStatus.NotFound);
      expect(error.message).to.equal("CodeSpec not found");
    }
  });

  it("should fail because non existent name", async () => {
    const codeSpecName = "non-existent-name";

    try {
      await iModel.codeSpecs.getByName(codeSpecName);
    } catch (error: any) {
      expect(error).to.be.instanceOf(IModelError);
      expect(error.errorNumber).to.equal(IModelStatus.NotFound);
      expect(error.message).to.equal("CodeSpec not found");
    }
  });
});
