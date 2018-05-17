/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as utils from "./TestUtils";

import { AccessToken } from "../../";

import {
  IModelHubClient, CodeState, Code, AggregateResponseError, ConflictingCodesError, CodeQuery,
  IModelHubRequestError, IModelHubRequestErrorId,
} from "../../imodelhub";

import { ResponseBuilder } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";

chai.should();

describe("iModelHub CodeHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let briefcaseId: number;
  let briefcaseId2: number;
  const imodelName = "imodeljs-clients Codes test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();
  const continueOptions = { CustomOptions: { ConflictStrategy: "Continue" } };

  before(async () => {
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);

    const briefcases = await utils.getBriefcases(accessToken, iModelId, 2);
    briefcaseId = briefcases[0].briefcaseId!;
    briefcaseId2 = briefcases[1].briefcaseId!;
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should reserve multiple codes", async () => {
    const code1 = utils.randomCode(briefcaseId);
    const code2 = utils.randomCode(briefcaseId);

    utils.mockUpdateCodes(iModelId, code1, code2);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(2);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));
  });

  it("should fail on conflicting codes", async () => {
    const code1 = utils.randomCode(briefcaseId);
    const code2 = utils.randomCode(briefcaseId);
    const code3 = utils.randomCode(briefcaseId);
    const code4 = utils.randomCode(briefcaseId);

    utils.mockUpdateCodes(iModelId, code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    utils.mockDeniedCodes(iModelId, undefined, code2);
    utils.mockDeniedCodes(iModelId, undefined, code3);
    utils.mockUpdateCodes(iModelId, code4);

    let receivedError: Error | undefined;
    try {
      await imodelHubClient.Codes().update(accessToken, iModelId, [code2, code3, code4], { codesPerRequest: 1 });
    } catch (error) {
      receivedError = error;
    }
    chai.assert(receivedError);
    chai.expect(receivedError).to.be.instanceof(AggregateResponseError);
  });

  it("should return conflicting codes", async () => {
    const code1 = utils.randomCode(briefcaseId);
    const code2 = utils.randomCode(briefcaseId);
    const code3 = utils.randomCode(briefcaseId);
    const code4 = utils.randomCode(briefcaseId);

    utils.mockUpdateCodes(iModelId, code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    utils.mockDeniedCodes(iModelId, continueOptions, code2);
    utils.mockDeniedCodes(iModelId, continueOptions, code3);
    utils.mockUpdateCodes(iModelId, code4);

    let receivedError: ConflictingCodesError | undefined;
    try {
      await imodelHubClient.Codes().update(accessToken, iModelId, [code2, code3, code4],
        { deniedCodes: true, codesPerRequest: 1, continueOnConflict: true });
    } catch (error) {
      chai.expect(error).to.be.instanceof(ConflictingCodesError);
      receivedError = error;
    }
    chai.assert(receivedError);
    chai.assert(receivedError!.conflictingCodes);
    chai.expect(receivedError!.conflictingCodes!.length).to.be.equal(2);
    chai.expect(receivedError!.conflictingCodes![0].value).to.be.equal(code2.value);
    chai.expect(receivedError!.conflictingCodes![1].value).to.be.equal(code3.value);
  });

  it("should update code multiple times", async () => {
    let code = utils.randomCode(briefcaseId);
    utils.mockUpdateCodes(iModelId, code);
    let result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.assert(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Reserved);

    code.state = CodeState.Used;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";
    utils.mockUpdateCodes(iModelId, code);
    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.assert(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Used);

    code.state = CodeState.Retired;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";
    utils.mockUpdateCodes(iModelId, code);
    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.assert(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Retired);
  });

  it("should get codes", async () => {
    utils.mockGetCodes(iModelId, undefined, utils.randomCode(briefcaseId), utils.randomCode(briefcaseId));
    const codes = await imodelHubClient.Codes().get(accessToken, iModelId);
    chai.assert(codes);
    chai.expect(codes).length.to.be.greaterThan(0);
  });

  it("should get codes only with their values", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const query = new CodeQuery().select("Value");
    const codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    codes.forEach((code) => {
      chai.assert(code.wsgId);
      chai.assert(code.value);
      chai.assert(!code.codeScope);
      chai.assert(!code.codeSpecId);
      chai.assert(!code.briefcaseId);
      chai.assert(!code.createdDate);
    });
  });

  it("should get codes by briefcase id", async () => {
    const filter = `?$filter=BriefcaseId+eq+${briefcaseId}`;
    utils.mockGetCodes(iModelId, filter, utils.randomCode(briefcaseId), utils.randomCode(briefcaseId));

    const query = new CodeQuery().byBriefcaseId(briefcaseId);
    const codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    chai.assert(codes);
    chai.expect(codes).length.to.be.greaterThan(0);
    codes.forEach((code) => chai.expect(code.briefcaseId).to.be.equal(briefcaseId));
  });

  it("should get codes by code spec id", async () => {
    const codeSpecId = utils.randomCode(briefcaseId).codeSpecId!;
    const filter = `?$filter=CodeSpecId+eq+%27${codeSpecId}%27`;
    utils.mockGetCodes(iModelId, filter, utils.randomCode(briefcaseId), utils.randomCode(briefcaseId));

    const query = new CodeQuery().byCodeSpecId(codeSpecId);
    const codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    chai.assert(codes);
    chai.expect(codes).length.to.be.greaterThan(0);
    codes.forEach((code) => chai.expect(code.codeSpecId!.toUpperCase()).to.be.equal(codeSpecId.toUpperCase()));
  });

  it("should get codes by code spec id and briefcase id", async () => {
    const codes = [utils.randomCode(briefcaseId), utils.randomCode(briefcaseId)];
    const codeSpecId = codes[0].codeSpecId!;
    const filter = `BriefcaseId+eq+${briefcaseId}+and+CodeSpecId+eq+%27${codeSpecId}%27`;

    utils.mockGetCodes(iModelId, "?$filter=" + filter, ...codes);
    const query1 = new CodeQuery().byBriefcaseId(briefcaseId).byCodeSpecId(codeSpecId);
    const queriedCodes1 = await imodelHubClient.Codes().get(accessToken, iModelId, query1);
    chai.assert(queriedCodes1);

    utils.mockGetCodes(iModelId, "?$filter=" + filter, ...codes);
    const query2 = new CodeQuery().filter(filter);
    const queriedCodes2 = await imodelHubClient.Codes().get(accessToken, iModelId, query2);
    chai.assert(queriedCodes2);

    chai.expect(queriedCodes1).to.be.deep.equal(queriedCodes2);
  });

  it("should get codes by code scope", async () => {
    const codeScope = utils.randomCode(briefcaseId).codeScope!;
    const filter = `?$filter=CodeScope+eq+%27${codeScope}%27`;
    utils.mockGetCodes(iModelId, filter, utils.randomCode(briefcaseId), utils.randomCode(briefcaseId));

    const query = new CodeQuery().byCodeScope(codeScope);
    const codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    chai.assert(codes);
    chai.expect(codes).length.to.be.greaterThan(0);
    codes.forEach((code) => chai.expect(code.codeScope).to.be.equal(codeScope));
  });

  it("should get codes by instance ids", async () => {
    const mockedCodes = [utils.randomCode(briefcaseId), utils.randomCode(briefcaseId)];
    utils.mockGetCodes(iModelId, undefined, ...mockedCodes);

    let existingCodes = await imodelHubClient.Codes().get(accessToken, iModelId);
    existingCodes = existingCodes.slice(0, 2);

    const filter = `?$filter=$id+in+[%270XA-TestScope-${mockedCodes[0].value!}%27,%270XA-TestScope-${mockedCodes[1].value!}%27]`;
    utils.mockGetCodes(iModelId, filter, ...mockedCodes);
    const query = new CodeQuery().byCodes(existingCodes);
    const codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    chai.assert(codes);
    chai.expect(codes.length).to.be.greaterThan(0);
    chai.expect(codes).to.be.deep.equal(existingCodes);
  });

  it("should relinquish codes", async () => {
    const filter = `?$filter=BriefcaseId+eq+${briefcaseId}`;
    utils.mockGetCodes(iModelId, filter, utils.randomCode(briefcaseId), utils.randomCode(briefcaseId));
    const query = new CodeQuery().byBriefcaseId(briefcaseId);
    let codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    chai.expect(codes.length).to.be.greaterThan(0);

    utils.mockDeleteAllCodes(iModelId, briefcaseId);
    await imodelHubClient.Codes().deleteAll(accessToken, iModelId, briefcaseId);

    utils.mockGetCodes(iModelId, filter);
    codes = await imodelHubClient.Codes().get(accessToken, iModelId, query);
    chai.expect(codes.length).to.be.equal(0);
  });

  it("should not create a query by codes with empty array", () => {
    let error: IModelHubRequestError | undefined;
    try {
      new CodeQuery().byCodes([]);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id!).to.be.equal(IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should not create a query by codes with invalid codes", () => {
    let error: IModelHubRequestError | undefined;
    try {
      new CodeQuery().byCodes([new Code()]);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id!).to.be.equal(IModelHubRequestErrorId.InvalidArgumentError);
  });

  it("should fail deleting all codes with invalid briefcase id", async () => {
    let error: IModelHubRequestError | undefined;
    try {
      await imodelHubClient.Codes().deleteAll(accessToken, iModelId, 0);
    } catch (err) {
      if (err instanceof IModelHubRequestError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.id!).to.be.equal(IModelHubRequestErrorId.InvalidArgumentError);
  });
});
