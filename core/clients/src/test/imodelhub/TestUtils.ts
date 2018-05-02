/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Code, CodeState, MultiCode } from "../../imodelhub/Codes";
import { Briefcase } from "../../imodelhub/Briefcases";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { ECJsonTypeMap } from "../../ECJsonTypeMap";
import { TestConfig, UserCredentials } from "../TestConfig";
import { Guid } from "@bentley/bentleyjs-core";

import { ChangeSet } from "../../imodelhub/ChangeSets";
import { Version } from "../../imodelhub/Versions";
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

export const defaultUrl = "https://qa-imodelhubapi.bentley.com";
/**
 * Generates request URL.
 * @param scope Specifies scope.
 * @param id Specifies scope id.
 * @param className Class name that request is sent to.
 * @param query Request query.
 * @returns Created URL.
 */
export function createRequestUrl(scope: ScopeType, id: string, className: string, query?: string): string {
  let requestUrl: string = "/v2.5/Repositories/";

  switch (scope) {
    case ScopeType.iModel:
      requestUrl += "iModel--" + id + "/iModelScope/";
      break;
    case ScopeType.Project:
      requestUrl += "Project--" + id + "/ProjectScope/";
      break;
    case ScopeType.Global:
      requestUrl += "Global--Global/GlobalScope/";
      break;
  }

  requestUrl += className + "/";
  if (query !== undefined) {
    requestUrl += query;
  }

  return requestUrl;
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

/** iModels */
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

/** Briefcases */
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

export function generateBriefcase(id: number): Briefcase {
  const briefcase = new Briefcase();
  briefcase.briefcaseId = id;
  briefcase.wsgId = id.toString();
  return briefcase;
}

export function mockGetBriefcase(responseBuilder: ResponseBuilder, iModelId: string, ...briefcases: Briefcase[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
  const requestResponse = responseBuilder.generateGetArrayResponse<Briefcase>(briefcases);
  responseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockCreateBriefcase(responseBuilder: ResponseBuilder, iModelId: string, id: number) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
  const postBody = responseBuilder.generatePostBody<Briefcase>(responseBuilder.generateObject<Briefcase>(Briefcase));
  const requestResponse = responseBuilder.generatePostResponse<Briefcase>(generateBriefcase(id));
  responseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

/** ChangeSets */
export function generateChangeSetId(): string {
  let result = "";
  for (let i = 0; i < 20; ++i) {
    result += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  }
  return result;
}

export function generateChangeSet(id?: string): ChangeSet {
  const changeSet = new ChangeSet();
  id = id || generateChangeSetId();
  changeSet.fileName = id + ".cs";
  changeSet.wsgId = id;
  return changeSet;
}

export function mockGetChangeSet(responseBuilder: ResponseBuilder, iModelId: string, ...changeSets: ChangeSet[]) {
  if (!TestConfig.enableMocks)
    return;

  let i = 1;
  changeSets.forEach((value) => {
    value.downloadUrl = "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile";
    value.index = `${i++}`;
  });
  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
    `?$select=*,FileAccessKey-forward-AccessKey.DownloadURL`);
  const requestResponse = responseBuilder.generateGetArrayResponse<ChangeSet>(changeSets);
  responseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

/** Codes */
export function randomCodeValue(prefix: string): string {
  return (prefix +  Math.floor(Math.random() * Math.pow(2, 30)).toString());
}

export function randomCode(briefcase: number): Code {
  const code = new Code();
  code.briefcaseId = briefcase;
  code.codeScope = "TestScope";
  code.codeSpecId = "0XA";
  code.state = CodeState.Reserved;
  code.value = randomCodeValue("TestCode");
  return code;
}

export function mockUpdateCodes(responseBuilder: ResponseBuilder, iModelId: string, ...codes: Code[]) {
  // assumes all have same scope / specId
  if (!TestConfig.enableMocks)
    return;

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
  responseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

export function mockDeniedCodes(responseBuilder: ResponseBuilder, iModelId: string, ...codes: Code[]) {
  // assumes all have same scope / specId
  if (!TestConfig.enableMocks)
    return;

  const multiCode = new MultiCode();
  multiCode.briefcaseId = codes[0].briefcaseId;
  multiCode.codeScope = codes[0].codeScope;
  multiCode.codeSpecId = codes[0].codeSpecId;
  multiCode.state = codes[0].state;
  multiCode.values = codes.map((value) => value.value!);
  multiCode.changeState = "new";

  const requestPath = `/v2.5/Repositories/iModel--${iModelId}/$changeset`;
  const requestResponse = responseBuilder.generateError("iModelHub.CodeReservedByAnotherBriefcase", "", "",
    new Map<string, any>([
      ["ConflictingCodes", JSON.stringify(codes.map((value) => {
        const obj = ECJsonTypeMap.toJson<Code>("wsg", value);
        return obj.properties;
      }))],
    ]));
  const postBody = responseBuilder.generateChangesetBody<MultiCode>([multiCode]);
  responseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);
}

/** Named versions */
export function generateVersion(name?: string, changesetId?: string): Version {
  const result = new Version();
  result.wsgId = Guid.createValue();
  result.changeSetId = changesetId || generateChangeSetId();
  result.name = name || `TestVersion-${result.changeSetId!}`;
  return result;
}

export function mockGetVersions(responseBuilder: ResponseBuilder, imodelId: string, ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, "Version");
  const requestResponse = responseBuilder.generateGetArrayResponse<Version>(versions);
  responseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockGetVersionById(responseBuilder: ResponseBuilder, imodelId: string, version: Version) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, "Version", version.wsgId);
  const requestResponse = responseBuilder.generateGetResponse<Version>(version);
  responseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockFileResponse(responseBuilder: ResponseBuilder, downloadToPath: string, times = 1) {
  if (TestConfig.enableMocks)
    responseBuilder.mockFileResponse("https://imodelhubqasa01.blob.core.windows.net", "/imodelhubfile", downloadToPath + "empty-files/empty.bim", times);
}
