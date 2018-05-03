/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { IModelTestUtils, TestUsers } from "./IModelTestUtils";
import { IModelDb } from "../backend";
import { ConcurrencyControl } from "../ConcurrencyControl";
import { IModel as HubIModel, IModelQuery, AccessToken } from "@bentley/imodeljs-clients";
import { HubTestUtils } from "./HubTestUtils";
import * as utils from "./../../../clients/lib/test/imodelhub/TestUtils";
import { ResponseBuilder, RequestType, ScopeType } from "./../../../clients/lib/test/ResponseBuilder";
import { createNewModelAndCategory } from "./BriefcaseManager.test";
import { TestConfig } from "./TestConfig";

describe.skip("PushRetry", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  const responseBuilder: ResponseBuilder = new ResponseBuilder();
  const iModelName = "PushRetryTest";

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken(TestUsers.superManager);
    testProjectId = await HubTestUtils.queryProjectIdByName(accessToken, TestConfig.projectName);
  });

  it("should retry to push changes", async () => {
    const iModels: HubIModel[] = await HubTestUtils.hubClient!.IModels().get(accessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await HubTestUtils.hubClient!.IModels().delete(accessToken, testProjectId, iModelTemp.wsgId);
    }

    const pushRetryIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const pushRetryIModelId = pushRetryIModel.iModelToken.iModelId;
    assert.isNotEmpty(pushRetryIModelId);

    pushRetryIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    const r: { modelId: Id64, spatialCategoryId: Id64 } = await createNewModelAndCategory(pushRetryIModel, accessToken);

    pushRetryIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(pushRetryIModel, r.modelId, r.spatialCategoryId));
    pushRetryIModel.saveChanges("User created model, category, and two elements");

    let retryCount = 1;
    const responseFunction  = () => {
      switch (retryCount++) {
          case 1:
            return responseBuilder.generateError("iModelHub.PullIsRequired");
          case 2:
            return responseBuilder.generateError("iModelHub.DatabaseTemporarilyLocked");
          case 3:
            return responseBuilder.generateError("iModelHub.AnotherUserPushing");
          default:
            responseBuilder.clearMocks();
            return responseBuilder.generateError("iModelHub.iModelHubOperationFailed");
      }
    };

    responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get,
      utils.createRequestUrl(ScopeType.iModel, pushRetryIModelId!, "ChangeSet", "?$top=1&$orderby=Index+desc"),
      responseFunction, 5, undefined, undefined, 409);

    await pushRetryIModel.pushChanges(accessToken);
    responseBuilder.clearMocks();
    await HubTestUtils.hubClient!.IModels().delete(accessToken, testProjectId, pushRetryIModelId!);
  });

  it("should fail to push and not retry again", async () => {
    const iModels: HubIModel[] = await HubTestUtils.hubClient!.IModels().get(accessToken, testProjectId, new IModelQuery().byName(iModelName));
    for (const iModelTemp of iModels) {
      await HubTestUtils.hubClient!.IModels().delete(accessToken, testProjectId, iModelTemp.wsgId);
    }

    const pushRetryIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, iModelName, { rootSubject: { name: "TestSubject" } });
    const pushRetryIModelId = pushRetryIModel.iModelToken.iModelId;
    assert.isNotEmpty(pushRetryIModelId);

    const r: { modelId: Id64, spatialCategoryId: Id64 } = await createNewModelAndCategory(pushRetryIModel, accessToken);

    pushRetryIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(pushRetryIModel, r.modelId, r.spatialCategoryId));
    pushRetryIModel.saveChanges("User created model, category, and two elements");

    const response = responseBuilder.generateError("UnknownPushError");
    responseBuilder.mockResponse(utils.defaultUrl, RequestType.Get,
      utils.createRequestUrl(ScopeType.iModel, pushRetryIModelId!, "ChangeSet", "?$top=1&$orderby=Index+desc"),
      response, 5, undefined, undefined, 409);

    try {
      await pushRetryIModel.pushChanges(accessToken);
    } catch (error) {
      assert.exists(error);
      assert.equal(error.name, "UnknownPushError");
    }
    responseBuilder.clearMocks();
    await HubTestUtils.hubClient!.IModels().delete(accessToken, testProjectId, pushRetryIModelId!);
  });
});
