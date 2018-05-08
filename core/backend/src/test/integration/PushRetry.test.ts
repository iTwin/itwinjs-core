/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { IModelTestUtils, TestUsers } from "../IModelTestUtils";
import { IModelDb } from "../../backend";
import { BriefcaseManager } from "../../BriefcaseManager";
import { ConcurrencyControl } from "../../ConcurrencyControl";
import { IModel as HubIModel, IModelQuery, AccessToken } from "@bentley/imodeljs-clients";
import { HubTestUtils } from "./HubTestUtils";
import * as utils from "./../../../../clients/lib/test/imodelhub/TestUtils";
import { ResponseBuilder, RequestType, ScopeType } from "./../../../../clients/lib/test/ResponseBuilder";
import { createNewModelAndCategory } from "./BriefcaseManager.test";
import { TestConfig } from "../TestConfig";

describe.skip("PushRetry", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  const iModelName = "PushRetryTest";

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    testProjectId = await HubTestUtils.queryProjectIdByName(accessToken, TestConfig.projectName);
  });

  it("should retry to push changes (#integration)", async () => {
    const iModels: HubIModel[] = await BriefcaseManager.hubClient.IModels().get(accessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.hubClient.IModels().delete(accessToken, testProjectId, iModelTemp.wsgId);
    }

    const pushRetryIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const pushRetryIModelId = pushRetryIModel.iModelToken.iModelId;
    assert.isNotEmpty(pushRetryIModelId);

    pushRetryIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    const r: { modelId: Id64, spatialCategoryId: Id64 } = await createNewModelAndCategory(pushRetryIModel, accessToken);

    pushRetryIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(pushRetryIModel, r.modelId, r.spatialCategoryId));
    pushRetryIModel.saveChanges("User created model, category, and two elements");

    let retryCount = 1;
    const responseFunction = () => {
      switch (retryCount++) {
        case 1:
          return ResponseBuilder.generateError("iModelHub.PullIsRequired");
        case 2:
          return ResponseBuilder.generateError("iModelHub.DatabaseTemporarilyLocked");
        case 3:
          return ResponseBuilder.generateError("iModelHub.AnotherUserPushing");
        default:
          ResponseBuilder.clearMocks();
          return ResponseBuilder.generateError("iModelHub.iModelHubOperationFailed");
      }
    };

    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get,
      utils.createRequestUrl(ScopeType.iModel, pushRetryIModelId!, "ChangeSet", "?$top=1&$orderby=Index+desc"),
      responseFunction, 5, undefined, undefined, 409);

    await pushRetryIModel.pushChanges(accessToken);
    ResponseBuilder.clearMocks();
    await BriefcaseManager.hubClient.IModels().delete(accessToken, testProjectId, pushRetryIModelId!);
  });

  it("should fail to push and not retry again (#integration)", async () => {
    const iModels: HubIModel[] = await BriefcaseManager.hubClient.IModels().get(accessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await BriefcaseManager.hubClient.IModels().delete(accessToken, testProjectId, iModelTemp.wsgId);
    }

    const pushRetryIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const pushRetryIModelId = pushRetryIModel.iModelToken.iModelId;
    assert.isNotEmpty(pushRetryIModelId);

    const r: { modelId: Id64, spatialCategoryId: Id64 } = await createNewModelAndCategory(pushRetryIModel, accessToken);

    pushRetryIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(pushRetryIModel, r.modelId, r.spatialCategoryId));
    pushRetryIModel.saveChanges("User created model, category, and two elements");

    const response = ResponseBuilder.generateError("UnknownPushError");
    ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get,
      utils.createRequestUrl(ScopeType.iModel, pushRetryIModelId!, "ChangeSet", "?$top=1&$orderby=Index+desc"),
      response, 5, undefined, undefined, 409);

    try {
      await pushRetryIModel.pushChanges(accessToken);
    } catch (error) {
      assert.exists(error);
      assert.equal(error.name, "UnknownPushError");
    }
    ResponseBuilder.clearMocks();
    await BriefcaseManager.hubClient.IModels().delete(accessToken, testProjectId, pushRetryIModelId!);
  });
});
