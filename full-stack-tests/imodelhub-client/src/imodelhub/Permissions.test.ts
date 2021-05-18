/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as fs from "fs";
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { HubIModel, IModelClient, IModelHubPermission } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext, ECJsonTypeMap, WsgInstance } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { workDir } from "./TestConstants";

@ECJsonTypeMap.classToJson("wsg", "RBAC.PermissionContainer", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RbacPermissionContainer extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[RolePermission].relatedInstance[Permission].instanceId")
  public permissionId?: string;
}

@ECJsonTypeMap.classToJson("wsg", "RBAC.ObjectType", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class RbacObjectType extends WsgInstance { }

function mockGetContextPermissions(contextId: string, userId: string, permissionId: string) {
  if (!TestConfig.enableMocks)
    return;

  contextId = contextId || Guid.createValue();
  const requestPath = `/v2.4/Repositories/BentleyCONNECT--Main/RBAC/User/${userId}/Context?$select=Permission.*&$filter=$id+eq+%27${contextId}%27+and+Permission.ServiceGPRId+eq+2485`;
  const requestResponse = ResponseBuilder.generateGetResponse<RbacPermissionContainer>(ResponseBuilder.generateObject<RbacPermissionContainer>(RbacPermissionContainer,
    new Map<string, any>([
      ["permissionId", permissionId],
    ])));
  ResponseBuilder.mockResponse(utils.RbacUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetiModelPermissions(userId: string, imodelId: string, objectTypeId: string, permissionId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = `/v2.4/Repositories/BentleyCONNECT--Main/RBAC/User/${userId}/Object?$select=Permission.*&$filter=$id+eq+%27${imodelId}%27+and+typeid+eq+%27${objectTypeId}%27`;
  const requestResponse = ResponseBuilder.generateGetResponse<RbacPermissionContainer>(ResponseBuilder.generateObject<RbacPermissionContainer>(RbacPermissionContainer,
    new Map<string, any>([
      ["permissionId", permissionId],
    ])));
  ResponseBuilder.mockResponse(utils.RbacUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetObjectTypeId(objectId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = `/v2.4/Repositories/BentleyCONNECT--Main/RBAC/ObjectType?$filter=Name+eq+%27IMHS_ObjectType_iModel%27+and+ServiceGPRId+eq+2485`;
  const requestResponse = ResponseBuilder.generateGetResponse<RbacObjectType>(ResponseBuilder.generateObject<RbacObjectType>(RbacObjectType,
    new Map<string, any>([
      ["wsgId", objectId],
    ])));
  ResponseBuilder.mockResponse(utils.RbacUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

function mockGetIModel(contextId: string, imodelId: GuidString, secured: boolean) {
  if (!TestConfig.enableMocks)
    return;

  imodelId = imodelId || Guid.createValue();

  const requestPath = utils.createRequestUrl(ScopeType.Context, contextId, "iModel", imodelId);
  const responseProperties = new Map<string, any>([
    ["wsgId", imodelId.toString()],
    ["id", imodelId],
    ["secured", secured],
  ]);
  const requestResponse = ResponseBuilder.generateGetResponse<HubIModel>(
    ResponseBuilder.generateObject<HubIModel>(HubIModel, responseProperties), 1);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Get, requestPath, requestResponse);
}

describe("iModelHub PermissionsManager", () => {
  let projectId: string;
  let imodelId: GuidString;
  let imodelClient: IModelClient;
  let requestContext: AuthorizedClientRequestContext;

  before(async function () {
    this.timeout(0);
    const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext(accessToken);

    (requestContext as any).activityId = "iModelHub PermissionHandler";
    projectId = await utils.getProjectId(requestContext, "iModelJsTest");

    await utils.createIModel(requestContext, utils.sharedimodelName, projectId);
    imodelId = await utils.getIModelId(requestContext, utils.sharedimodelName, projectId);
    imodelClient = utils.getIModelHubClient();

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir);
    }
  });

  afterEach(async () => {
    ResponseBuilder.clearMocks();
  });

  after(async () => {
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(requestContext, projectId, utils.sharedimodelName);
    }
  });

  it("should get Context permissions (#unit)", async () => {
    const permissionsHandler = imodelClient.permissions!;
    mockGetContextPermissions(projectId, requestContext.accessToken.getUserInfo()!.id, "IMHS_Read_iModel");

    const contextPermissions = await permissionsHandler.getContextPermissions(requestContext, projectId);
    chai.expect(contextPermissions).to.eq(IModelHubPermission.View | IModelHubPermission.Read);
  });

  it("should get not secured iModel permissions (#unit)", async () => {
    mockGetContextPermissions(projectId, requestContext.accessToken.getUserInfo()!.id, "IMHS_Modify_iModel");
    mockGetIModel(projectId, imodelId, false);

    const permissionsHandler = imodelClient.permissions!;
    const imodelPermissions = await permissionsHandler.getiModelPermissions(requestContext, projectId, imodelId);
    chai.expect(imodelPermissions).to.eq(IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify);
  });

  it("should get secured iModel permissions (#unit)", async () => {
    const objectTypeId = "objectTypeId";
    mockGetContextPermissions(projectId, requestContext.accessToken.getUserInfo()!.id, "IMHS_Read_iModel");
    mockGetIModel(projectId, imodelId, true);
    mockGetObjectTypeId(objectTypeId);
    mockGetiModelPermissions(requestContext.accessToken.getUserInfo()!.id, imodelId, objectTypeId, "IMHS_Manage_Versions");

    const permissionsHandler = imodelClient.permissions!;
    const imodelPermissions = await permissionsHandler.getiModelPermissions(requestContext, projectId, imodelId);
    chai.expect(imodelPermissions).to.eq(IModelHubPermission.ManageVersions | IModelHubPermission.View | IModelHubPermission.Read | IModelHubPermission.Modify);
  });
});
