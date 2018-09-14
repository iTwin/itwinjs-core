/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as utils from "./TestUtils";

import { Guid, IModelHubStatus, ActivityLoggingContext } from "@bentley/bentleyjs-core";

import { AccessToken, IModelClient } from "../../";
import {
  LockEvent, AllLocksDeletedEvent, ChangeSetPostPushEvent, ChangeSetPrePushEvent,
  CodeEvent, AllCodesDeletedEvent, BriefcaseDeletedEvent, SeedFileReplacedEvent, IModelLockEvent,
  IModelDeletedEvent, VersionEvent, EventSubscription, EventSAS, EventType, IModelHubEvent,
} from "../../";

import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";

chai.should();

function mockCreateEventSubscription(imodelId: string, eventTypes: EventType[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSubscription");
  const requestResponse = ResponseBuilder.generatePostResponse<EventSubscription>(ResponseBuilder.generateObject<EventSubscription>(EventSubscription,
    new Map<string, any>([
      ["wsgId", Guid.createValue()],
      ["eventTypes", eventTypes],
    ])));
  const postBody = ResponseBuilder.generatePostBody<EventSubscription>(ResponseBuilder.generateObject<EventSubscription>(EventSubscription,
    new Map<string, any>([
      ["eventTypes", eventTypes],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUpdateEventSubscription(imodelId: string, subscriptionId: string, eventTypes: EventType[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSubscription", subscriptionId);
  const requestResponse = ResponseBuilder.generatePostResponse<EventSubscription>(ResponseBuilder.generateObject<EventSubscription>(EventSubscription,
    new Map<string, any>([
      ["wsgId", subscriptionId],
      ["eventTypes", eventTypes],
    ])));
  const postBody = ResponseBuilder.generatePostBody<EventSubscription>(ResponseBuilder.generateObject<EventSubscription>(EventSubscription,
    new Map<string, any>([
      ["wsgId", subscriptionId],
      ["eventTypes", eventTypes],
    ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetEventSASToken(imodelId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSAS");
  const responseObject = ResponseBuilder.generateObject<EventSAS>(EventSAS,
    new Map<string, any>([
      ["sasToken", Guid.createValue()],
      ["baseAddress", `${utils.defaultUrl}/sv1.1/Repositories/iModel--${imodelId}/iModelScope`],
    ]));
  const requestResponse = ResponseBuilder.generatePostResponse<EventSAS>(responseObject);
  const postBody = ResponseBuilder.generatePostBody<EventSAS>(ResponseBuilder.generateObject<EventSAS>(EventSAS));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetEvent(imodelId: string, subscriptionId: string, eventBody: object | (() => object), eventType?: string, timeout?: number, statusCode = 200, delay = 0) {
  if (!TestConfig.enableMocks)
    return;

  const headers = eventType ? { "content-type": eventType! } : {};
  let query = subscriptionId + "/messages/head";
  if (timeout)
    query += `?timeout=${timeout}`;
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Subscriptions", query);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath, eventBody, 1, {}, headers, statusCode, delay);
}

function mockDeleteEventSubscription(imodelId: string, subscriptionId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSubscription", subscriptionId);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

describe("iModelHub EventHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  let subscription: EventSubscription;
  let briefcaseId: number;
  let sasToken: EventSAS;
  const imodelName = "imodeljs-clients Events test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();
  const alctx = new ActivityLoggingContext("");

  before(async () => {
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    briefcaseId = (await utils.getBriefcases(accessToken, iModelId, 1))[0].briefcaseId!;
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should subscribe to event subscription", async () => {
    const eventTypes: EventType[] = ["CodeEvent"];
    mockCreateEventSubscription(iModelId, eventTypes);

    subscription = await imodelHubClient.Events().Subscriptions().create(alctx, accessToken, iModelId, eventTypes);
    chai.assert(subscription);
    chai.expect(subscription.eventTypes).to.be.deep.equal(eventTypes);
  });

  it("should fail getting SAS token with invalid accessToken", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    let error;
    try {
      await imodelHubClient.Events().getSASToken(alctx, new utils.MockAccessToken(), iModelId);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status).to.be.equal(401);
  });

  it("should get SAS token", async () => {
    mockGetEventSASToken(iModelId);
    sasToken = await imodelHubClient.Events().getSASToken(alctx, accessToken, iModelId);
    chai.assert(sasToken);
  });

  it("should fail receiving event with invalid SAS token", async () => {
    mockGetEvent(iModelId, subscription.wsgId, {}, undefined, undefined, 401);
    let error;
    try {
      await imodelHubClient.Events().getEvent(alctx, "InvalidSASToken", sasToken.baseAddress!, subscription.wsgId);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status).to.be.equal(401);
  });

  it("should fail receiving event with undefined subscription id", async () => {
    mockGetEvent(iModelId, "", {}, undefined, undefined, 404);
    let error;
    try {
      await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, "");
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.errorNumber!).to.be.equal(IModelHubStatus.UndefinedArgumentError);
  });

  it("should return undefined when no event is available", async () => {
    mockGetEvent(iModelId, subscription.wsgId, {}, undefined, undefined, 204);
    const result = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(result).to.be.equal(undefined);
  });

  it("should receive code event", async () => {
    const codes = [utils.randomCode(briefcaseId)];
    if (!TestConfig.enableMocks) {
      await imodelHubClient.Codes().update(alctx, accessToken, iModelId, codes);
    } else {
      const requestResponse = '{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":1,"CodeScope":"0X100000000FF","CodeSpecId":"0xff","State":1,"Values":["TestCode"]}';
      mockGetEvent(iModelId, subscription.wsgId, JSON.parse(requestResponse), "CodeEvent");
    }

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);

    chai.expect(event).to.be.instanceof(CodeEvent);
  });

  it("should receive events through listener", async function (this: Mocha.ITestCallbackContext) {
    const codes = [utils.randomCode(briefcaseId), utils.randomCode(briefcaseId)];

    if (TestConfig.enableMocks) {
      mockGetEventSASToken(iModelId);
      const requestResponse = JSON.parse('{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":1,"CodeScope":"0X100000000FF","CodeSpecId":"0xff","State":1,"Values":["TestCode"]}');
      mockGetEvent(iModelId, subscription.wsgId, requestResponse, "CodeEvent", 60);
      mockGetEvent(iModelId, subscription.wsgId, requestResponse, "CodeEvent", 60);
      mockGetEvent(iModelId, subscription.wsgId, {}, undefined, 60, 204, 2000);
    }

    let receivedEventsCount = 0;
    const deleteListener = imodelHubClient.Events().createListener(alctx, async () => {
      return await utils.login();
    }, subscription.wsgId, iModelId, (receivedEvent: IModelHubEvent) => {
      if (receivedEvent instanceof CodeEvent)
        receivedEventsCount++;
    });

    if (!TestConfig.enableMocks) {
      await imodelHubClient.Codes().update(alctx, accessToken, iModelId, [codes[0]]);
      await imodelHubClient.Codes().update(alctx, accessToken, iModelId, [codes[1]]);
    }

    let timeoutCounter = 0;
    for (; timeoutCounter < 100; ++timeoutCounter) {
      if (receivedEventsCount === 2)
        break;
      await new Promise((resolve) => setTimeout(resolve, TestConfig.enableMocks ? 1 : 100));
    }
    deleteListener();
    chai.expect(timeoutCounter).to.be.lessThan(100);
  });

  it("should update event subscription", async () => {
    const eventTypes: EventType[] = ["iModelDeletedEvent", "BriefcaseDeletedEvent"];
    mockUpdateEventSubscription(iModelId, subscription.wsgId, eventTypes);
    subscription.eventTypes = eventTypes;

    subscription = await imodelHubClient.Events().Subscriptions().update(alctx, accessToken, iModelId, subscription);
    chai.assert(subscription);
    chai.expect(subscription.eventTypes).to.be.deep.equal(eventTypes);
  });

  it("should receive LockEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":2,"LockType":"1","LockLevel":"1","ObjectIds":["1"],"ReleasedWithChangeSet":"1"}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "LockEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(LockEvent);
  });

  it("should receive AllLocksDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":2}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "AllLocksDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(AllLocksDeletedEvent);
  });

  it("should receive ChangeSetPostPushEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":2,"ChangeSetId":"789","ChangeSetIndex":2}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "ChangeSetPostPushEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(ChangeSetPostPushEvent);
  });

  it("should receive ChangeSetPrePushEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":""}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "ChangeSetPrePushEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(ChangeSetPrePushEvent);
  });

  it("should receive AllCodesDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":2}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "AllCodesDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(AllCodesDeletedEvent);
  });

  it("should receive BriefcaseDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":2}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "BriefcaseDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(BriefcaseDeletedEvent);
  });

  it("should receive SeedFileReplacedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","FileId":"789"}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "SeedFileReplacedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(SeedFileReplacedEvent);
  });

  it("should receive IModelLockEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","Locked":true}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "iModelLockEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(IModelLockEvent);
  });

  it("should receive IModelDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":""}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "iModelDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(IModelDeletedEvent);
  });

  it("should receive VersionEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","VersionId":"789","VersionName":"ABC","ChangeSetId":"2"}`;
    mockGetEvent(iModelId, subscription.wsgId, JSON.parse(eventBody), "VersionEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(VersionEvent);
  });

  it("should delete subscription", async () => {
    mockDeleteEventSubscription(iModelId, subscription.wsgId);
    await imodelHubClient.Events().Subscriptions().delete(alctx, accessToken, iModelId, subscription.wsgId);
  });
});
