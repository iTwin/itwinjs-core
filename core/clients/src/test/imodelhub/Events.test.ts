/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as utils from "./TestUtils";

import { Guid, IModelHubStatus, ActivityLoggingContext, Id64 } from "@bentley/bentleyjs-core";

import { AccessToken, IModelClient } from "../../";
import {
  LockEvent, AllLocksDeletedEvent, ChangeSetPostPushEvent, ChangeSetPrePushEvent,
  CodeEvent, AllCodesDeletedEvent, BriefcaseDeletedEvent, IModelDeletedEvent, VersionEvent,
  EventSubscription, EventSAS, EventType, IModelHubEvent,
} from "../../";

import { TestConfig } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { LockLevel, LockType } from "../../imodelhub";

chai.should();

function mockCreateEventSubscription(imodelId: Guid, eventTypes: EventType[]) {
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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUpdateEventSubscription(imodelId: Guid, subscriptionId: string, eventTypes: EventType[]) {
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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetEventSASToken(imodelId: Guid) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSAS");
  const responseObject = ResponseBuilder.generateObject<EventSAS>(EventSAS,
    new Map<string, any>([
      ["sasToken", Guid.createValue()],
      ["baseAddress", `${utils.IModelHubUrlMock.getUrl()}/sv1.1/Repositories/iModel--${imodelId}/iModelScope`],
    ]));
  const requestResponse = ResponseBuilder.generatePostResponse<EventSAS>(responseObject);
  const postBody = ResponseBuilder.generatePostBody<EventSAS>(ResponseBuilder.generateObject<EventSAS>(EventSAS));
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockGetEvent(imodelId: Guid, subscriptionId: string, eventBody: object | (() => object), eventType?: string, timeout?: number, statusCode = 200, delay = 0) {
  if (!TestConfig.enableMocks)
    return;

  const headers = eventType ? { "content-type": eventType! } : {};
  let query = subscriptionId + "/messages/head";
  if (timeout)
    query += `?timeout=${timeout}`;
  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Subscriptions", query);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath, eventBody, 1, {}, headers, statusCode, delay);
}

function mockDeleteEventSubscription(imodelId: Guid, subscriptionId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSubscription", subscriptionId);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath);
}

describe("iModelHub EventHandler", () => {
  let accessToken: AccessToken;
  let imodelId: Guid;
  let subscription: EventSubscription;
  let briefcaseId: number;
  let sasToken: EventSAS;
  const imodelName = "imodeljs-clients Events test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();
  const alctx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    accessToken = await utils.login();
    await utils.createIModel(accessToken, imodelName);
    imodelId = await utils.getIModelId(accessToken, imodelName);
    briefcaseId = (await utils.getBriefcases(accessToken, imodelId, 1))[0].briefcaseId!;
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should subscribe to event subscription", async () => {
    const eventTypes: EventType[] = ["CodeEvent"];
    mockCreateEventSubscription(imodelId, eventTypes);

    subscription = await imodelHubClient.Events().Subscriptions().create(alctx, accessToken, imodelId, eventTypes);
    chai.assert(subscription);
    chai.expect(subscription.eventTypes).to.be.deep.equal(eventTypes);
  });

  it("should fail getting SAS token with invalid accessToken", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    let error;
    try {
      await imodelHubClient.Events().getSASToken(alctx, new utils.MockAccessToken(), imodelId);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status).to.be.equal(401);
  });

  it("should get SAS token", async () => {
    mockGetEventSASToken(imodelId);
    sasToken = await imodelHubClient.Events().getSASToken(alctx, accessToken, imodelId);
    chai.assert(sasToken);
  });

  it("should fail receiving event with invalid SAS token", async () => {
    mockGetEvent(imodelId, subscription.wsgId, {}, undefined, undefined, 401);
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
    mockGetEvent(imodelId, "", {}, undefined, undefined, 404);
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
    mockGetEvent(imodelId, subscription.wsgId, {}, undefined, undefined, 204);
    const result = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(result).to.be.equal(undefined);
  });

  it("should receive code event", async () => {
    const codes = [utils.randomCode(briefcaseId)];
    if (!TestConfig.enableMocks) {
      await imodelHubClient.Codes().update(alctx, accessToken, imodelId, codes);
    } else {
      const requestResponse = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":1,"CodeScope":"0x100000000ff","CodeSpecId":"0xff","State":1,"Values":["TestCode"]}`;
      mockGetEvent(imodelId, subscription.wsgId, JSON.parse(requestResponse), "CodeEvent");
    }

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);

    chai.expect(event).to.be.instanceof(CodeEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
    chai.expect(event!.iModelId!.toString()).to.be.equal(imodelId.toString());
    const typedEvent = event as CodeEvent;
    chai.assert(typedEvent);
    chai.expect(typedEvent.codeSpecId).to.be.instanceof(Id64);
  });

  it("should receive events through listener", async function (this: Mocha.ITestCallbackContext) {
    const codes = [utils.randomCode(briefcaseId), utils.randomCode(briefcaseId)];

    if (TestConfig.enableMocks) {
      mockGetEventSASToken(imodelId);
      const requestResponse = JSON.parse(`{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":1,"CodeScope":"0x100000000ff","CodeSpecId":"0xff","State":1,"Values":["TestCode"]}`);
      mockGetEvent(imodelId, subscription.wsgId, requestResponse, "CodeEvent", 60);
      mockGetEvent(imodelId, subscription.wsgId, requestResponse, "CodeEvent", 60);
      mockGetEvent(imodelId, subscription.wsgId, {}, undefined, 60, 204, 2000);
    }

    let receivedEventsCount = 0;
    const deleteListener = imodelHubClient.Events().createListener(alctx, async () => {
      return await utils.login();
    }, subscription.wsgId, imodelId, (receivedEvent: IModelHubEvent) => {
      if (receivedEvent instanceof CodeEvent)
        receivedEventsCount++;
    });

    if (!TestConfig.enableMocks) {
      await imodelHubClient.Codes().update(alctx, accessToken, imodelId, [codes[0]]);
      await imodelHubClient.Codes().update(alctx, accessToken, imodelId, [codes[1]]);
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
    mockUpdateEventSubscription(imodelId, subscription.wsgId, eventTypes);
    subscription.eventTypes = eventTypes;

    subscription = await imodelHubClient.Events().Subscriptions().update(alctx, accessToken, imodelId, subscription);
    chai.assert(subscription);
    chai.expect(subscription.eventTypes).to.be.deep.equal(eventTypes);
  });

  it("should receive LockEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":2,"LockType":"1","LockLevel":"1","ObjectIds":["0x1"],"ReleasedWithChangeSet":"1"}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "LockEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(LockEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
    const typedEvent = event as LockEvent;
    chai.assert(!!typedEvent);
    chai.assert(!!typedEvent.objectIds![0]);
    chai.assert(typedEvent.objectIds![0].isValid);
    chai.expect(typedEvent.objectIds![0].toString()).to.be.equal(new Id64("0x1").toString());
    chai.expect(typedEvent.lockLevel).to.be.equal(LockLevel.Shared);
    chai.expect(typedEvent.lockType).to.be.equal(LockType.Model);
  });

  it("should receive AllLocksDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":2}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "AllLocksDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(AllLocksDeletedEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
  });

  it("should receive ChangeSetPostPushEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":2,"ChangeSetId":"789","ChangeSetIndex":2}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "ChangeSetPostPushEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(ChangeSetPostPushEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
  });

  it("should receive ChangeSetPrePushEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":""}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "ChangeSetPrePushEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(ChangeSetPrePushEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
  });

  it("should receive AllCodesDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":2}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "AllCodesDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(AllCodesDeletedEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
  });

  it("should receive BriefcaseDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","BriefcaseId":2}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "BriefcaseDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(BriefcaseDeletedEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
  });

  it("should receive IModelDeletedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":""}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "iModelDeletedEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(IModelDeletedEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
  });

  it("should receive VersionEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const versionId = new Guid(true);
    const eventBody = `{"EventTopic":"${imodelId}","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","VersionId":"${versionId}","VersionName":"ABC","ChangeSetId":"2"}`;
    mockGetEvent(imodelId, subscription.wsgId, JSON.parse(eventBody), "VersionEvent");

    const event = await imodelHubClient.Events().getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    chai.expect(event).to.be.instanceof(VersionEvent);
    chai.expect(event!.iModelId).to.be.instanceof(Guid);
    const typedEvent = event as VersionEvent;
    chai.assert(!!typedEvent);
    chai.expect(typedEvent.versionId!.toString()).to.be.equal(versionId.toString());
  });

  it("should delete subscription", async () => {
    mockDeleteEventSubscription(imodelId, subscription.wsgId);
    await imodelHubClient.Events().Subscriptions().delete(alctx, accessToken, imodelId, subscription.wsgId);
  });
});
