/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Code, CodeState, MultiCode } from "../../imodelhub/Codes";
import { ResponseBuilder, RequestType } from "../ResponseBuilder";
import { ECJsonTypeMap } from "../../ECJsonTypeMap";
import { TestConfig, UserCredentials } from "../TestConfig";
import { Guid } from "@bentley/bentleyjs-core";

import { IModelQuery } from "../../imodelhub/IModels";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { UserProfile } from "../../UserProfile";
import { ConnectClient, Project } from "../../ConnectClients";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public getUserProfile(): UserProfile|undefined {
    return new UserProfile ("test", "user", "testuser001@mailinator.com", "596c0d8b-eac2-46a0-aa4a-b590c3314e7c", "Bentley");
  }
  public toTokenString() { return ""; }
}

export async function login(user?: UserCredentials): Promise<AccessToken> {
  if (TestConfig.enableMocks)
    return new MockAccessToken();

  const authToken = await TestConfig.login(user);
  const client = new IModelHubClient(TestConfig.deploymentEnv);

  return await client.getAccessToken(authToken);
}

export async function getProjectId(projectName?: string): Promise<string> {
  if (TestConfig.enableMocks)
    return Guid.createValue();

  const authToken = await TestConfig.login();
  const client = await new ConnectClient(TestConfig.deploymentEnv);
  const accessToken = await client.getAccessToken(authToken);

  projectName = projectName || TestConfig.projectName;
  const project: Project | undefined = await client.getProject(accessToken, {
    $select: "*",
    $filter: `Name+eq+'${projectName}'`,
  });
  if (!project || !project.wsgId)
    return Promise.reject(`Project with name ${TestConfig.projectName} doesn't exist.`);

  return Promise.resolve(project.wsgId);
}

export async function deleteIModelByName(accessToken: AccessToken, projectId: string, imodelName: string): Promise<void> {
  if (TestConfig.enableMocks)
    return;

  const client = new IModelHubClient(TestConfig.deploymentEnv);
  const imodels = await client.IModels().get(accessToken, projectId, new IModelQuery().byName(imodelName));
  for (const imodel of imodels) {
    await client.IModels().delete(accessToken, projectId, imodel.wsgId);
  }
}

export async function getIModelId(accessToken: AccessToken, imodelName?: string): Promise<string> {
  if (TestConfig.enableMocks)
    return Guid.createValue();

  const projectId = await getProjectId();

  const client = new IModelHubClient(TestConfig.deploymentEnv);

  imodelName = imodelName || TestConfig.iModelName;
  const imodels = await client.IModels().get(accessToken, projectId, new IModelQuery().byName(imodelName));

  if (!imodels[0] || !imodels[0].wsgId)
    return Promise.reject(`iModel with name ${TestConfig.iModelName} doesn't exist.`);

  return imodels[0].wsgId;
}

export async function getBriefcases(accessToken: AccessToken, imodelId: string, count: number): Promise<number[]> {
  if (TestConfig.enableMocks) {
    let briefcaseId = 2;
    return Array(count).fill(0).map(() => briefcaseId++);
  }

  const client = new IModelHubClient(TestConfig.deploymentEnv);
  let briefcases = await client.Briefcases().get(accessToken, imodelId);
  if (briefcases.length < count) {
    for (let i = 0; i < count - briefcases.length; ++i) {
      await client.Briefcases().create(accessToken, imodelId);
    }
    briefcases = await client.Briefcases().get(accessToken, imodelId);
  }
  return briefcases.map((value) => value.briefcaseId!);
}

export function randomCodeValue(prefix: string): string {
    return (prefix +  Math.floor(Math.random() * Math.pow(2, 30)).toString());
  }

export  function randomCode(briefcase: number): Code {
    const code = new Code();
    code.briefcaseId = briefcase;
    code.codeScope = "TestScope";
    code.codeSpecId = "0XA";
    code.state = CodeState.Reserved;
    code.value = randomCodeValue("TestCode");
    return code;
  }

/** assumes all have same scope / specId */
export function mockUpdateCodes(responseBuilder: ResponseBuilder, iModelId: string, ...codes: Code[]) {
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
export function mockDeniedCodes(responseBuilder: ResponseBuilder, iModelId: string, ...codes: Code[]) {
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
