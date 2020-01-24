/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const expect = chai.expect;

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { BisCodeSpec, CodeSpec } from "@bentley/imodeljs-common";

import { TestContext } from "./setup/TestContext";

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
});
