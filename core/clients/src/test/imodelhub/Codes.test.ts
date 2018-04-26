/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import * as chaiAsPromised from "chai-as-promised";

import { TestConfig } from "../TestConfig";

import { IModel, CodeState, Code, MultiCode, IModelQuery, AggregateResponseError, ConflictingCodesError } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AuthorizationToken, AccessToken } from "../../Token";
import { ConnectClient, Project } from "../../ConnectClients";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import { ECJsonTypeMap } from "../../index";

chai.use(chaiString);
chai.use(chaiAsPromised);
chai.should();

describe("iModelHub CodeHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  // let seedFileId: string;
  const briefcaseId: number = 2;
  const briefcaseId2: number = 3;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  before(async () => {
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);

    const project: Project | undefined = await connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    });
    chai.expect(project);

    projectId = project.wsgId;
    chai.expect(projectId);

    const requestPath = responseBuilder.createRequestUrl(ScopeType.Project, projectId, "iModel",
                                              "?$filter=Name+eq+%27" + TestConfig.iModelName + "%27");
    const requestResponse = responseBuilder.generateGetResponse<IModel>(responseBuilder.generateObject<IModel>(IModel,
                                            new Map<string, any>([
                                              ["wsgId", "b74b6451-cca3-40f1-9890-42c769a28f3e"],
                                              ["name", TestConfig.iModelName],
                                            ])));
    responseBuilder.MockResponse(RequestType.Get, requestPath, requestResponse);
    const iModels = await imodelHubClient.IModels().get(accessToken, projectId, new IModelQuery().byName(TestConfig.iModelName));

    if (!iModels[0].wsgId) {
      chai.assert(false);
      return;
    }

    iModelId = iModels[0].wsgId;
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  function randomCodeValue(prefix: string): string {
    return (prefix +  Math.floor(Math.random() * Math.pow(2, 30)).toString());
  }

  function randomCode(briefcase: number): Code {
    const code = new Code();
    code.briefcaseId = briefcase;
    code.codeScope = "TestScope";
    code.codeSpecId = "0XA";
    code.state = CodeState.Reserved;
    code.value = randomCodeValue("TestCode");
    return code;
  }

  /** assumes all have same scope / specId */
  function mockUpdateCodes(...codes: Code[]) {
    const multiCode = new MultiCode();
    multiCode.briefcaseId = codes[0].briefcaseId;
    multiCode.codeScope = codes[0].codeScope;
    multiCode.codeSpecId = codes[0].codeSpecId;
    multiCode.state = codes[0].state;
    multiCode.values = codes.map((value) => value.value!);
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    const requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);
  }

  /** assumes all have same scope / specId */
  function mockDeniedCodes(...codes: Code[]) {
    const multiCode = new MultiCode();
    multiCode.briefcaseId = codes[0].briefcaseId;
    multiCode.codeScope = codes[0].codeScope;
    multiCode.codeSpecId = codes[0].codeSpecId;
    multiCode.state = codes[0].state;
    multiCode.values = codes.map((value) => value.value!);
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    const requestResponse = responseBuilder.generateError("iModelHub.CodeReservedByAnotherBriefcase", "", "", new Map<string, any>([["ConflictingCodes", JSON.stringify(codes.map((value) => {
      const obj = ECJsonTypeMap.toJson<Code>("wsg", value);
      return obj.properties;
    })),
    ]]));
    const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);
  }

  it("should reserve multiple codes", async () => {
    const code1 = randomCode(briefcaseId);
    const code2 = randomCode(briefcaseId);

    mockUpdateCodes(code1, code2);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(2);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));
  });

  it("should fail on conflicting codes", async () => {
    const code1 = randomCode(briefcaseId);
    const code2 = randomCode(briefcaseId);
    const code3 = randomCode(briefcaseId);
    const code4 = randomCode(briefcaseId);

    mockUpdateCodes(code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    mockDeniedCodes(code2);
    mockDeniedCodes(code3);
    mockUpdateCodes(code4);

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
    const code1 = randomCode(briefcaseId);
    const code2 = randomCode(briefcaseId);
    const code3 = randomCode(briefcaseId);
    const code4 = randomCode(briefcaseId);

    mockUpdateCodes(code1, code2, code3);

    const result = await imodelHubClient.Codes().update(accessToken, iModelId, [code1, code2, code3]);
    chai.expect(result);
    chai.expect(result.length).to.be.equal(3);
    result.forEach((value: Code) => chai.expect(value.state).to.be.equal(CodeState.Reserved));

    code2.briefcaseId = briefcaseId2;
    code3.briefcaseId = briefcaseId2;
    code4.briefcaseId = briefcaseId2;

    mockDeniedCodes(code2);
    mockDeniedCodes(code3);
    mockUpdateCodes(code4);

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
    let code = new Code();
    code.briefcaseId = briefcaseId;
    code.codeScope = "TestScope";
    code.codeSpecId = "0XA";
    code.state = CodeState.Reserved;
    code.changeState = "new";
    code.value = randomCodeValue("TestCode");

    const multiCode = new MultiCode();
    multiCode.briefcaseId = code.briefcaseId;
    multiCode.codeScope = code.codeScope;
    multiCode.codeSpecId = code.codeSpecId;
    multiCode.state = code.state;
    multiCode.values = [code.value];
    multiCode.changeState = "new";

    const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
    let requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    let postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    let result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Reserved);

    code.state = CodeState.Used;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";

    multiCode.state = code.state;
    requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Used);

    code.state = CodeState.Retired;
    code.briefcaseId = briefcaseId;
    code.changeState = "new";

    multiCode.state = code.state;
    requestResponse = responseBuilder.generateChangesetResponse<MultiCode>([multiCode]);
    postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    result = await imodelHubClient.Codes().update(accessToken, iModelId, [code]);

    chai.expect(result);
    chai.expect(result.length).to.be.equal(1);
    code = result[0];
    chai.expect(code.state).to.be.equal(CodeState.Retired);
  });
});
