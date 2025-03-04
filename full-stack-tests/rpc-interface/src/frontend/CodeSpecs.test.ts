/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { BisCodeSpec, CodeSpec, IModelError, IModelStatus } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { TestContext } from "./setup/TestContext";

const expect = chai.expect;

describe("Get Code Specs", () => {
  let testContext: TestContext;

  before(async function () {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();
  });

  const existing = {
    name: BisCodeSpec.subject,
    id: "0x1f",
  };

  /** verify that given codespec has expected properties */
  function verifyCodeSpec(codeSpec: CodeSpec, requestedIModel: IModelConnection, requestedName: string, requestedId: string) {

    expect(codeSpec).to.exist;

    expect(codeSpec.id).to.exist;
    expect(codeSpec.id).to.equal(requestedId);

    expect(codeSpec.name).to.exist;
    expect(codeSpec.name).to.equal(requestedName);

    expect(codeSpec.iModel).to.exist;
    expect(codeSpec.iModel.name).to.equal(requestedIModel.name);
  }

  it("should return code spec by name", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecName = existing.name;
    const codeSpecId = existing.id;

    const codeSpec = await iModel.codeSpecs.getByName(codeSpecName);

    verifyCodeSpec(codeSpec, iModel, codeSpecName, codeSpecId);
  });

  it("should return code spec by id", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecName = existing.name;
    const codeSpecId = existing.id;

    const codeSpec = await iModel.codeSpecs.getById(codeSpecId);

    verifyCodeSpec(codeSpec, iModel, codeSpecName, codeSpecId);
  });

  it("should fail because empty id", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecId = "";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    }
    catch (error: any) {
        expect(error).to.be.instanceOf(IModelError);
        expect(error.errorNumber).to.equal(IModelStatus.NotFound);
        expect(error.message).to.equal("CodeSpec not found");
    }
  });

  it("should fail because empty name", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecName = "";

    try {
      await iModel.codeSpecs.getByName(codeSpecName);
    }
    catch (error: any) {
        expect(error).to.be.instanceOf(IModelError);
        expect(error.errorNumber).to.equal(IModelStatus.NotFound);
        expect(error.message).to.equal("CodeSpec not found");
    }
  });

  it("should fail because invalid id", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecId = "0";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    }
    catch (error: any) {
        expect(error).to.be.instanceOf(IModelError);
        expect(error.errorNumber).to.equal(IModelStatus.InvalidId);
        expect(error.message).to.equal("Invalid codeSpecId");
        expect(error.getMetaData).to.be.a('function');
        expect(error.getMetaData()).to.deep.equal({ codeSpecId });
    }
  });

  it("should fail because non existent id", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecId = "0xff";

    try {
      await iModel.codeSpecs.getById(codeSpecId);
    }
    catch (error: any) {
        expect(error).to.be.instanceOf(IModelError);
        expect(error.errorNumber).to.equal(IModelStatus.NotFound);
        expect(error.message).to.equal("CodeSpec not found");
    }
  });

  it("should fail because non existent name", async () => {
    const iModel = await testContext.iModelWithChangesets!.getConnection();
    const codeSpecName = "non-existent-name";

    try {
      await iModel.codeSpecs.getByName(codeSpecName);
    }
    catch (error: any) {
        expect(error).to.be.instanceOf(IModelError);
        expect(error.errorNumber).to.equal(IModelStatus.NotFound);
        expect(error.message).to.equal("CodeSpec not found");
    }
  });
});
