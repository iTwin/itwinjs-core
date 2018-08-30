/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as chai from "chai";

import { Guid, EnvMacroSubst } from "@bentley/bentleyjs-core";

import {
  ECJsonTypeMap, AccessToken, UserProfile, Project,
  ProgressInfo, UrlDescriptor, DeploymentEnv, IModelClient,
} from "../../";
import {
  IModelHubClient, Code, CodeState, MultiCode, Briefcase, ChangeSet, Version,
  Thumbnail, SmallThumbnail, LargeThumbnail, IModelQuery, LockType, LockLevel,
  MultiLock, Lock, VersionQuery,
} from "../../";
import { IModelBaseHandler } from "../../imodelhub/BaseHandler";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";

import { ResponseBuilder, RequestType, ScopeType, UrlDiscoveryMock } from "../ResponseBuilder";
import { TestConfig, UserCredentials, TestUsers } from "../TestConfig";
import { IModelProjectAbstraction } from "../../IModelProjectAbstraction";
import { IModelBankFileSystemProject, IModelBankFileSystemProjectOptions, IModelBankServerConfig } from "../../IModelBank/IModelBankFileSystemProject";
import { TestIModelHubProject } from "./IModelHubProject";

/** Other services */
export class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public getUserProfile(): UserProfile | undefined {
    return new UserProfile("test", "user", "testuser001@mailinator.com", "596c0d8b-eac2-46a0-aa4a-b590c3314e7c", "Bentley", "1004144426", "US");
  }
  public toTokenString() { return ""; }
}

export type RequestBehaviorOptionsList =
  "DoNotScheduleRenderThumbnailJob" |
  "DisableGlobalEvents" |
  "DisableNotifications";

export class RequestBehaviorOptions {
  private _currentOptions: RequestBehaviorOptionsList[] = this.getDefaultOptions();

  private getDefaultOptions(): RequestBehaviorOptionsList[] {
    return ["DoNotScheduleRenderThumbnailJob", "DisableGlobalEvents", "DisableNotifications"];
  }

  public resetDefaultBehaviorOptions(): void {
    this._currentOptions = this.getDefaultOptions();
  }

  public enableBehaviorOption(option: RequestBehaviorOptionsList) {
    if (!this._currentOptions.find((el) => el === option)) {
      this._currentOptions.push(option);
    }
  }
  public disableBehaviorOption(option: RequestBehaviorOptionsList) {
    const foundIdx: number = this._currentOptions.findIndex((el) => el === option);
    if (-1 < foundIdx) {
      this._currentOptions.splice(foundIdx, 1);
    }
  }

  public toCustomRequestOptions(): { [index: string]: string } {
    return { BehaviourOptions: this._currentOptions.join(",") };
  }
}

const requestBehaviorOptions = new RequestBehaviorOptions();

let _imodelHubClient: IModelHubClient;
function getImodelHubClient() {
  if (_imodelHubClient !== undefined)
    return _imodelHubClient;
  _imodelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  if (!TestConfig.enableMocks) {
    _imodelHubClient.CustomRequestOptions().setCustomOptions(requestBehaviorOptions.toCustomRequestOptions());
  }
  return _imodelHubClient;
}

export class IModelHubUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-imodelhubapi.bentley.com",
    QA: "https://qa-imodelhubapi.bentley.com",
    PROD: "https://imodelhubapi.bentley.com",
    PERF: "https://perf-imodelhubapi.bentley.com",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(IModelBaseHandler.searchKey, env, this._urlDescriptor[env]);
  }
}

export const defaultUrl: string = IModelHubUrlMock.getUrl(TestConfig.deploymentEnv);

export function getClient(imodelId: string): IModelClient {
  return projectAbstraction.getClientForIModel(undefined, imodelId);
}

export function getDefaultClient() {
  IModelHubUrlMock.mockGetUrl(TestConfig.deploymentEnv);
  return getImodelHubClient();
}

export function getRequestBehaviorOptionsHandler(): RequestBehaviorOptions {
  return requestBehaviorOptions;
}

export const assetsPath = __dirname + "/../../../lib/test/assets/";
export const workDir = __dirname + "/../../../lib/test/output/";

/**
 * Generates request URL.
 * @param scope Specifies scope.
 * @param id Specifies scope id.
 * @param className Class name that request is sent to.
 * @param query Request query.
 * @returns Created URL.
 */
export function createRequestUrl(scope: ScopeType, id: string, className: string, query?: string): string {
  let requestUrl: string = "/sv1.1/Repositories/";

  switch (scope) {
    case ScopeType.iModel:
      requestUrl += `iModel--${id}/iModelScope/`;
      break;
    case ScopeType.Project:
      requestUrl += `Project--${id}/ProjectScope/`;
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

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(userCredentials?: UserCredentials): Promise<AccessToken> {
  if (TestConfig.enableMocks)
    return new MockAccessToken();

  userCredentials = userCredentials || TestUsers.regular;
  return projectAbstraction.authorizeUser(undefined, userCredentials, TestConfig.deploymentEnv);
}

export async function getProjectId(accessToken: AccessToken, projectName?: string): Promise<string> {
  if (TestConfig.enableMocks)
    return Guid.createValue();

  projectName = projectName || TestConfig.projectName;

  const project: Project = await projectAbstraction.queryProject(accessToken, {
    $select: "*",
    $filter: `Name+eq+'${projectName}'`,
  });

  if (!project || !project.wsgId)
    return Promise.reject(`Project with name ${TestConfig.projectName} doesn't exist.`);

  return project.wsgId;
}

/** iModels */
export async function deleteIModelByName(accessToken: AccessToken, projectId: string, imodelName: string): Promise<void> {
  if (TestConfig.enableMocks)
    return;

  const imodels = await projectAbstraction.queryIModels(accessToken, projectId, new IModelQuery().byName(imodelName));
  for (const imodel of imodels) {
    await projectAbstraction.deleteIModel(accessToken, projectId, imodel.wsgId);
  }
}

export async function getIModelId(accessToken: AccessToken, imodelName: string): Promise<string> {
  if (TestConfig.enableMocks)
    return Guid.createValue();

  const projectId = await getProjectId(accessToken);

  const imodels = await projectAbstraction.queryIModels(accessToken, projectId, new IModelQuery().byName(imodelName));

  if (!imodels[0] || !imodels[0].wsgId)
    return Promise.reject(`iModel with name ${imodelName} doesn't exist.`);

  return imodels[0].wsgId;
}

export function mockFileResponse(times = 1) {
  if (TestConfig.enableMocks)
    ResponseBuilder.mockFileResponse("https://imodelhubqasa01.blob.core.windows.net", "/imodelhubfile", getMockSeedFilePath(), times);
}

export function getMockFileSize(): string {
  return fs.statSync(getMockSeedFilePath()).size.toString();
}

export function mockUploadFile(imodelId: string, chunks = 1) {
  for (let i = 0; i < chunks; ++i) {
    const blockId = Base64.encode(i.toString(16).padStart(5, "0"));
    ResponseBuilder.mockResponse(defaultUrl, RequestType.Put, `/imodelhub-${imodelId}/123456&comp=block&blockid=${blockId}`);
  }
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Put, `/imodelhub-${imodelId}/123456&comp=blocklist`);
}

/** Briefcases */
export async function getBriefcases(accessToken: AccessToken, imodelId: string, count: number): Promise<Briefcase[]> {
  if (TestConfig.enableMocks) {
    let briefcaseId = 2;
    const fileId = Guid.createValue();
    return Array(count).fill(0).map(() => {
      const briefcase = new Briefcase();
      briefcase.briefcaseId = briefcaseId++;
      briefcase.fileId = fileId;
      return briefcase;
    });
  }

  const client = getClient(imodelId);
  let briefcases = await client.Briefcases().get(accessToken, imodelId);
  if (briefcases.length < count) {
    for (let i = 0; i < count - briefcases.length; ++i) {
      await client.Briefcases().create(accessToken, imodelId);
    }
    briefcases = await client.Briefcases().get(accessToken, imodelId);
  }
  return briefcases;
}

export function generateBriefcase(id: number): Briefcase {
  const briefcase = new Briefcase();
  briefcase.briefcaseId = id;
  briefcase.wsgId = id.toString();
  return briefcase;
}

export function mockGetBriefcase(iModelId: string, ...briefcases: Briefcase[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Briefcase>(briefcases);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockCreateBriefcase(iModelId: string, id: number) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Briefcase");
  const postBody = ResponseBuilder.generatePostBody<Briefcase>(ResponseBuilder.generateObject<Briefcase>(Briefcase));
  const requestResponse = ResponseBuilder.generatePostResponse<Briefcase>(generateBriefcase(id));
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
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

export function mockGetChangeSet(iModelId: string, getDownloadUrl: boolean, query?: string, ...changeSets: ChangeSet[]) {
  if (!TestConfig.enableMocks)
    return;

  let i = 1;
  changeSets.forEach((value) => {
    value.wsgId = value.id!;
    if (getDownloadUrl) {
      value.downloadUrl = "https://imodelhubqasa01.blob.core.windows.net/imodelhubfile";
      value.fileSize = getMockFileSize();
    }
    if (!value.index) {
      value.index = `${i++}`;
    }
  });
  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "ChangeSet",
    getDownloadUrl ? `?$select=*,FileAccessKey-forward-AccessKey.DownloadURL` : query);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<ChangeSet>(changeSets);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

/** Codes */
export function randomCodeValue(prefix: string): string {
  return (prefix + Math.floor(Math.random() * Math.pow(2, 30)).toString());
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

function convertCodesToMultiCodes(codes: Code[]): MultiCode[] {
  const map = new Map<string, MultiCode>();
  for (const code of codes) {
    const id: string = `${code.codeScope}-${code.codeSpecId}-${code.state}`;

    if (map.has(id)) {
      map.get(id)!.values!.push(code.value!);
    } else {
      const multiCode = new MultiCode();
      multiCode.changeState = "new";
      multiCode.briefcaseId = code.briefcaseId;
      multiCode.codeScope = code.codeScope;
      multiCode.codeSpecId = code.codeSpecId;
      multiCode.state = code.state;
      multiCode.values = [code.value!];
      map.set(id, multiCode);
    }
  }
  return Array.from(map.values());
}

export function mockGetCodes(iModelId: string, query?: string, ...codes: Code[]) {
  if (!TestConfig.enableMocks)
    return;

  if (query === undefined) {
    const requestResponse = ResponseBuilder.generateGetArrayResponse<Code>(codes);
    const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Code", "$query");
    ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse);
  } else {
    const requestResponse = ResponseBuilder.generateGetArrayResponse<MultiCode>(convertCodesToMultiCodes(codes));
    const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "MultiCode", query);
    ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
  }
}

export function mockUpdateCodes(iModelId: string, ...codes: Code[]) {
  // assumes all have same scope / specId
  if (!TestConfig.enableMocks)
    return;

  const multicodes = convertCodesToMultiCodes(codes);
  const requestPath = `/sv1.1/Repositories/iModel--${iModelId}/$changeset`;
  const requestResponse = ResponseBuilder.generateChangesetResponse<MultiCode>(multicodes);
  const postBody = ResponseBuilder.generateChangesetBody<MultiCode>(multicodes);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

export function mockDeniedCodes(iModelId: string, requestOptions?: object, ...codes: Code[]) {
  // assumes all have same scope / specId
  if (!TestConfig.enableMocks)
    return;

  const multicodes = convertCodesToMultiCodes(codes);

  const requestPath = `/sv1.1/Repositories/iModel--${iModelId}/$changeset`;
  const requestResponse = ResponseBuilder.generateError("iModelHub.CodeReservedByAnotherBriefcase", "", "",
    new Map<string, any>([
      ["ConflictingCodes", JSON.stringify(codes.map((value) => {
        const obj = ECJsonTypeMap.toJson<Code>("wsg", value);
        return obj.properties;
      }))],
    ]));
  const postBody = ResponseBuilder.generateChangesetBody<MultiCode>(multicodes, requestOptions);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);
}

export function mockDeleteAllCodes(iModelId: string, briefcaseId: number) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Code", `DiscardReservedCodes-${briefcaseId}`);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Delete, requestPath, {});
}

/** Locks */
export function incrementLockObjectId(objectId: string): string {
  const objectIdNum = parseInt(objectId, 16) + 1;
  return "0x" + objectIdNum.toString(16);
}

export async function getLastLockObjectId(accessToken: AccessToken, iModelId: string): Promise<string> {
  if (TestConfig.enableMocks)
    return "0x0";

  const client = getClient(iModelId);
  const locks = await client.Locks().get(accessToken, iModelId);

  locks.sort((lock1, lock2) => (parseInt(lock1.objectId!, 16) > parseInt(lock2.objectId!, 16) ? -1 : 1));

  return (locks.length === 0 || locks[0].objectId === undefined) ? "0x0" : locks[0].objectId!;
}

export function generateLock(briefcaseId?: number, objectId?: string,
  lockType?: LockType, lockLevel?: LockLevel, seedFileId?: string, releasedWithChangeSet?: string, releasedWithChangeSetIndex?: string): Lock {
  const result = new Lock();
  result.briefcaseId = briefcaseId || 1;
  result.seedFileId = seedFileId;
  result.objectId = objectId || "0x0";
  result.lockLevel = lockLevel || 1;
  result.lockType = lockType || 1;
  result.releasedWithChangeSet = releasedWithChangeSet;
  result.releasedWithChangeSetIndex = releasedWithChangeSetIndex;
  return result;
}

function convertLocksToMultiLocks(locks: Lock[]): MultiLock[] {
  const map = new Map<string, MultiLock>();
  for (const lock of locks) {
    const id: string = `${lock.briefcaseId}-${lock.lockType}-${lock.lockLevel}`;

    if (map.has(id)) {
      map.get(id)!.objectIds!.push(lock.objectId!);
    } else {
      const multiLock = new MultiLock();
      multiLock.changeState = "new";
      multiLock.briefcaseId = lock.briefcaseId;
      multiLock.seedFileId = lock.seedFileId;
      multiLock.releasedWithChangeSet = lock.releasedWithChangeSet;
      multiLock.releasedWithChangeSetIndex = lock.releasedWithChangeSetIndex;
      multiLock.lockLevel = lock.lockLevel;
      multiLock.lockType = lock.lockType;
      multiLock.objectIds = [lock.objectId!];
      map.set(id, multiLock);
    }
  }
  return Array.from(map.values());
}

export function mockGetLocks(imodelId: string, query?: string, ...locks: Lock[]) {
  if (!TestConfig.enableMocks)
    return;

  if (query === undefined) {
    const requestResponse = ResponseBuilder.generateGetArrayResponse<Lock>(locks);
    const requestPath = createRequestUrl(ScopeType.iModel, imodelId, "Lock", "$query");
    ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse);
  } else {
    const requestResponse = ResponseBuilder.generateGetArrayResponse<MultiLock>(convertLocksToMultiLocks(locks));
    const requestPath = createRequestUrl(ScopeType.iModel, imodelId, "MultiLock", query);
    ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
  }
}

export function mockUpdateLocks(iModelId: string, locks: Lock[], requestOptions?: object) {
  if (!TestConfig.enableMocks)
    return;

  const multilocks = convertLocksToMultiLocks(locks);
  const requestPath = `/sv1.1/Repositories/iModel--${iModelId}/$changeset`;
  const requestResponse = ResponseBuilder.generateChangesetResponse<MultiLock>(multilocks);
  const postBody = ResponseBuilder.generateChangesetBody<MultiLock>(multilocks, requestOptions);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

export function mockDeniedLocks(iModelId: string, locks: Lock[], requestOptions?: object) {
  if (!TestConfig.enableMocks)
    return;

  const multilocks = convertLocksToMultiLocks(locks);

  const requestPath = `/sv1.1/Repositories/iModel--${iModelId}/$changeset`;
  const requestResponse = ResponseBuilder.generateError("iModelHub.LockOwnedByAnotherBriefcase", "", "",
    new Map<string, any>([
      ["ConflictingLocks", JSON.stringify(locks.map((value) => {
        const obj = ECJsonTypeMap.toJson<Lock>("wsg", value);
        return obj.properties;
      }))],
    ]));
  const postBody = ResponseBuilder.generateChangesetBody<MultiLock>(multilocks, requestOptions);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody, undefined, 409);
}

/** Named versions */
export function generateVersion(name?: string, changesetId?: string, smallThumbnailId?: string, largeThumbnailId?: string): Version {
  const result = new Version();
  result.wsgId = Guid.createValue();
  result.changeSetId = changesetId || generateChangeSetId();
  result.name = name || `TestVersion-${result.changeSetId!}`;
  result.smallThumbnailId = smallThumbnailId;
  result.largeThumbnailId = largeThumbnailId;
  return result;
}

export function mockGetVersions(imodelId: string, query?: string, ...versions: Version[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, "Version", query);
  const requestResponse = ResponseBuilder.generateGetArrayResponse<Version>(versions);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockGetVersionById(imodelId: string, version: Version) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, "Version", version.wsgId);
  const requestResponse = ResponseBuilder.generateGetResponse<Version>(version);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockCreateVersion(iModelId: string, name?: string, changesetId?: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Version");
  const postBodyObject = generateVersion(name, changesetId);
  delete (postBodyObject.wsgId);
  const postBody = ResponseBuilder.generatePostBody<Version>(postBodyObject);
  const requestResponse = ResponseBuilder.generatePostResponse<Version>(generateVersion(name, changesetId));
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

export function mockUpdateVersion(iModelId: string, version: Version) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, iModelId, "Version", version.wsgId);
  const postBody = ResponseBuilder.generatePostBody<Version>(version);
  const requestResponse = ResponseBuilder.generatePostResponse<Version>(version);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

/** Thumbnails */
export function generateThumbnail(size: "Small" | "Large"): Thumbnail {
  const result = size === "Small" ? new SmallThumbnail() : new LargeThumbnail();
  result.wsgId = Guid.createValue();
  return result;
}

function mockThumbnailResponse(requestPath: string, size: "Small" | "Large", ...thumbnails: Thumbnail[]) {
  const requestResponse = size === "Small" ?
    ResponseBuilder.generateGetArrayResponse<SmallThumbnail>(thumbnails) :
    ResponseBuilder.generateGetArrayResponse<LargeThumbnail>(thumbnails);
  ResponseBuilder.mockResponse(defaultUrl, RequestType.Get, requestPath, requestResponse);
}

export function mockGetThumbnails(imodelId: string, size: "Small" | "Large", ...thumbnails: Thumbnail[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, `${size}Thumbnail`);
  mockThumbnailResponse(requestPath, size, ...thumbnails);
}

export function mockGetThumbnailById(imodelId: string, size: "Small" | "Large", thumbnail: Thumbnail) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, `${size}Thumbnail`, thumbnail.wsgId);
  mockThumbnailResponse(requestPath, size, thumbnail);
}

export function mockGetThumbnailsByVersionId(imodelId: string, size: "Small" | "Large", versionId: string, ...thumbnails: Thumbnail[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = createRequestUrl(ScopeType.iModel, imodelId, `${size}Thumbnail`, `?$filter=HasThumbnail-backward-Version.Id+eq+%27${versionId}%27`);
  mockThumbnailResponse(requestPath, size, ...thumbnails);
}

/** Integration utilities */
export function getMockSeedFilePath() {
  const dir = path.join(assetsPath, "SeedFile");
  return path.join(dir, fs.readdirSync(dir).find((value) => value.endsWith(".bim"))!);
}

export async function createIModel(accessToken: AccessToken, name: string, projectId?: string, deleteIfExists = false) {
  if (TestConfig.enableMocks)
    return;

  projectId = projectId || await getProjectId(accessToken, TestConfig.projectName);

  const imodels = await projectAbstraction.queryIModels(accessToken, projectId, new IModelQuery().byName(name));

  if (imodels.length > 0) {
    if (deleteIfExists) {
      await projectAbstraction.deleteIModel(accessToken, projectId, imodels[0].wsgId);
    } else {
      return;
    }
  }

  return projectAbstraction.createIModel(accessToken, projectId, { name, description: "", seedFile: getMockSeedFilePath() });
}

export function getMockChangeSets(briefcase: Briefcase): ChangeSet[] {
  const dir = path.join(assetsPath, "SeedFile");
  const files = fs.readdirSync(dir);
  let parentId = "";
  return files.filter((value) => value.endsWith(".cs") && value.length === 45).map((file) => {
    const result = new ChangeSet();
    const fileName = path.basename(file, ".cs");
    result.id = fileName.substr(2);
    result.index = fileName.slice(0, 1);
    result.fileSize = fs.statSync(path.join(dir, file)).size.toString();
    result.briefcaseId = briefcase.briefcaseId;
    result.seedFileId = briefcase.fileId;
    result.parentId = parentId;
    result.fileName = result.id + ".cs";
    parentId = result.id;
    return result;
  });
}

export function getMockChangeSetPath(index: number, changeSetId: string) {
  return path.join(assetsPath, "SeedFile", `${index}_${changeSetId!}.cs`);
}

export async function createChangeSets(accessToken: AccessToken, imodelId: string, briefcase: Briefcase,
  startingId = 0, count = 1): Promise<ChangeSet[]> {
  if (TestConfig.enableMocks)
    return getMockChangeSets(briefcase).slice(startingId, startingId + count);

  const maxCount = 10;

  if (startingId + count > maxCount)
    throw Error(`Only have ${maxCount} changesets generated`);

  const client = getClient(imodelId);

  const currentCount = (await client.ChangeSets().get(accessToken, imodelId)).length;

  const changeSets = getMockChangeSets(briefcase);

  const result: ChangeSet[] = [];
  for (let i = currentCount; i < startingId + count; ++i) {
    const changeSetPath = getMockChangeSetPath(i, changeSets[i].id!);
    const changeSet = await client.ChangeSets().create(accessToken, imodelId, changeSets[i], changeSetPath);
    result.push(changeSet);
  }
  return result;
}

export async function createLocks(accessToken: AccessToken, imodelId: string, briefcase: Briefcase, count = 1,
  lockType: LockType = 1, lockLevel: LockLevel = 1, releasedWithChangeSet?: string, releasedWithChangeSetIndex?: string) {
  if (TestConfig.enableMocks)
    return;

  const client = getClient(imodelId);
  let lastObjectId = await getLastLockObjectId(accessToken, imodelId);
  const generatedLocks: Lock[] = [];

  for (let i = 0; i < count; i++) {
    generatedLocks.push(generateLock(briefcase.briefcaseId!,
      lastObjectId = incrementLockObjectId(lastObjectId), lockType, lockLevel, briefcase.fileId,
      releasedWithChangeSet, releasedWithChangeSetIndex));
  }

  await client.Locks().update(accessToken, imodelId, generatedLocks);
}

export async function createVersions(accessToken: AccessToken, imodelId: string, changesetIds: string[], versionNames: string[]) {
  if (TestConfig.enableMocks)
    return;

  const client = getClient(imodelId);
  for (let i = 0; i < changesetIds.length; i++) {
    // check if changeset does not have version
    const version = await client.Versions().get(accessToken, imodelId, new VersionQuery().byChangeSet(changesetIds[i]));
    if (!version || version.length === 0) {
      await client.Versions().create(accessToken, imodelId, changesetIds[i], versionNames[i]);
    }
  }
}

export class ProgressTracker {
  private _loaded: number = 0;
  private _total: number = 0;
  private _count: number = 0;

  public track() {
    return (progress: ProgressInfo) => {
      this._loaded = progress.loaded;
      this._total = progress.total!;
      this._count++;
    };
  }

  public check() {
    chai.expect(this._count).to.be.greaterThan(0);
    chai.expect(this._loaded).to.be.greaterThan(0);
    chai.expect(this._loaded).to.be.equal(this._total);
  }
}

let projectAbstraction: IModelProjectAbstraction;

export function getIModelProjectAbstraction(): IModelProjectAbstraction {
  if (projectAbstraction !== undefined)
    return projectAbstraction;

  if ((process.env.IMODELJS_CLIENTS_TEST_IMODEL_BANK === undefined) || TestConfig.enableMocks) {
    return projectAbstraction = new TestIModelHubProject();
  }

  const options: IModelBankFileSystemProjectOptions = {
    rootDir: workDir,
    name: TestConfig.projectName,
    env: TestConfig.deploymentEnv,
    deleteIfExists: true,
    createIfNotExist: true,
  };
  const serverConfigFile = path.resolve(__dirname, "../assets/iModelBank.server.config.json");
  const loggingConfigFile = path.resolve(__dirname, "../assets/iModelBank.logging.config.json");
  // tslint:disable-next-line:no-var-requires
  const serverConfig: IModelBankServerConfig = require(serverConfigFile);
  EnvMacroSubst.replaceInProperties(serverConfig, true);
  projectAbstraction = new IModelBankFileSystemProject(options, serverConfig, loggingConfigFile);
  return projectAbstraction;
}
