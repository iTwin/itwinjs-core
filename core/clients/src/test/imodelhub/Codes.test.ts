/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as utils from "./TestUtils";

import { TestConfig } from "../TestConfig";

import { CodeState, Code, AggregateResponseError, ConflictingCodesError } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";

chai.should();

describe("iModelHub CodeHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let briefcaseId: number;
  let briefcaseId2: number;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    accessToken = await utils.login();
    iModelId = await utils.getIModelId(accessToken);

    const briefcases = await utils.getBriefcases(accessToken, iModelId, 2);
    briefcaseId = briefcases[0];
    briefcaseId2 = briefcases[1];
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should reserve multiple codes", async () => {
    const code1 = utils.randomCode(briefcaseId);
    const code2 = utils.randomCode(briefcaseId);

    utils.mockUpdateCodes(responseBuilder, iModelId, code1, code2);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(2);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));
  });

  it("should fail on conflicting codes", async () => {
    const code1 = utils.randomCode(briefcaseId);
    const code2 = utils.randomCode(briefcaseId);
    const code3 = utils.randomCode(briefcaseId);
    const code4 = utils.randomCode(briefcaseId);

    utils.mockUpdateCodes(responseBuilder, iModelId, code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    utils.mockDeniedCodes(responseBuilder, iModelId, code2);
    utils.mockDeniedCodes(responseBuilder, iModelId, code3);
    utils.mockUpdateCodes(responseBuilder, iModelId, code4);

    let receivedError: Error | undefined;
    try {
      await imodelHubClient.Codes().update(accessToken, iModelId, [code2, code3, code4], { codesPerRequest: 1 });
    } catch (error) {
      receivedError = error;
    }
    chai.expect(receivedError);
    chai.expect(receivedError).to.be.instanceof(AggregateResponseError);
  });

  it("should return conflicting codes", async () => {
    const code1 = utils.randomCode(briefcaseId);
    const code2 = utils.randomCode(briefcaseId);
    const code3 = utils.randomCode(briefcaseId);
    const code4 = utils.randomCode(briefcaseId);

    utils.mockUpdateCodes(responseBuilder, iModelId, code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    utils.mockDeniedCodes(responseBuilder, iModelId, code2);
    utils.mockDeniedCodes(responseBuilder, iModelId, code3);
    utils.mockUpdateCodes(responseBuilder, iModelId, code4);

    let receivedError: ConflictingCodesError | undefined;
    try {
      await imodelHubClient.Codes().update(accessToken, iModelId, [code2, code3, code4],
        { deniedCodes: true, codesPerRequest: 1, continueOnConflict: true });
    } catch (error) {
      chai.expect(error).is.instanceof(ConflictingCodesError);
      receivedError = error;
    }
    chai.expect(receivedError);
    chai.expect(receivedError!.conflictingCodes);
    chai.expect(receivedError!.conflictingCodes!.length).to.be.equal(2);
    chai.expect(receivedError!.conflictingCodes![0].value).to.be.equal(code2.value);
    chai.expect(receivedError!.conflictingCodes![1].value).to.be.equal(code3.value);
  });

  it("should update code multiple times", async () => {
    let code = utils.randomCode(briefcaseId);
    utils.mockUpdateCodes(responseBuilder, iModelId, code);
    let result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Reserved);

    code.state = CodeState.Used;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";
    utils.mockUpdateCodes(responseBuilder, iModelId, code);
    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Used);

    code.state = CodeState.Retired;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";
    utils.mockUpdateCodes(responseBuilder, iModelId, code);
    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Retired);
  });
});
