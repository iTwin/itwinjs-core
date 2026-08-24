/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { BisCodeSpec, CodeScopeSpec, CodeSpec, IModelError } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";
import { IModelStatus, ProcessDetector } from "@itwin/core-bentley";

const describeChrome = ProcessDetector.isElectronAppFrontend ? describe.skip : describe;
describeChrome("IModelConnection.CodeSpecs", async () => {
  let iModel: IModelConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend();
    iModel = await TestSnapshotConnection.openFile("test.bim");
  });

  afterAll(async () => {
    if (iModel) {
      await iModel.close();
    }
    await TestUtility.shutdownFrontend();
  });

  const existing = {
    name: BisCodeSpec.subject,
    id: "0x1f",
  };

  it("should load CodeSpecs", async () => {
    const nullCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.nullCodeSpec);
    expect(nullCodeSpec.scopeType).toBe(CodeScopeSpec.Type.Repository);
    expect(nullCodeSpec.scopeReq).toBe(CodeScopeSpec.ScopeRequirement.ElementId);

    const subCategoryCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.subCategory);
    expect(subCategoryCodeSpec.scopeType).toBe(CodeScopeSpec.Type.ParentElement);
    expect(subCategoryCodeSpec.scopeReq).toBe(CodeScopeSpec.ScopeRequirement.ElementId);

    const viewDefinitionCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.viewDefinition);
    expect(viewDefinitionCodeSpec.scopeType).toBe(CodeScopeSpec.Type.Model);
    expect(viewDefinitionCodeSpec.scopeReq).toBe(CodeScopeSpec.ScopeRequirement.ElementId);
  });

  it("should return code spec by name", async () => {
    const codeSpecName = existing.name;
    const codeSpecId = existing.id;

    const codeSpec = await iModel.codeSpecs.getByName(codeSpecName);

    expect(codeSpec.id).toBe(codeSpecId);

    expect(codeSpec.name).toBe(codeSpecName);

    expect(codeSpec.iModel.name).toBe(iModel.name);
  });

  it("should return code spec by id", async () => {
    const codeSpecName = existing.name;
    const codeSpecId = existing.id;

    const codeSpec = await iModel.codeSpecs.getById(codeSpecId);

    expect(codeSpec.id).toBe(codeSpecId);

    expect(codeSpec.name).toBe(codeSpecName);

    expect(codeSpec.iModel.name).toBe(iModel.name);
  });

  it("should fail because empty id", async () => {
    const codeSpecId = "";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    } catch (error: any) {
      expect(error).toBeInstanceOf(IModelError);
      expect(error.errorNumber).toBe(IModelStatus.NotFound);
      expect(error.message).toBe("CodeSpec not found");
    }
  });

  it("should fail because empty name", async () => {
    const codeSpecName = "";

    try {
      await iModel.codeSpecs.getByName(codeSpecName);
    } catch (error: any) {
      expect(error).toBeInstanceOf(IModelError);
      expect(error.errorNumber).toBe(IModelStatus.NotFound);
      expect(error.message).toBe("CodeSpec not found");
    }
  });

  it("should fail because invalid id", async () => {
    const codeSpecId = "0";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    } catch (error: any) {
      expect(error).toBeInstanceOf(IModelError);
      expect(error.errorNumber).toBe(IModelStatus.InvalidId);
      expect(error.message).toBe("Invalid codeSpecId");
      expect(error.getMetaData).toEqual(expect.any(Function));
      expect(error.getMetaData()).toEqual({ codeSpecId });
    }
  });

  it("should fail because non existent id", async () => {
    const codeSpecId = "0xff";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    } catch (error: any) {
      expect(error).toBeInstanceOf(IModelError);
      expect(error.errorNumber).toBe(IModelStatus.NotFound);
      expect(error.message).toBe("CodeSpec not found");
    }
  });

  it("should fail because non existent name", async () => {
    const codeSpecName = "non-existent-name";

    try {
      await iModel.codeSpecs.getByName(codeSpecName);
    } catch (error: any) {
      expect(error).toBeInstanceOf(IModelError);
      expect(error.errorNumber).toBe(IModelStatus.NotFound);
      expect(error.message).toBe("CodeSpec not found");
    }
  });
});
