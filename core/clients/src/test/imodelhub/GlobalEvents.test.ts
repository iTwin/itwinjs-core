/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { Guid, ActivityLoggingContext } from "@bentley/bentleyjs-core";

import { AccessToken, IModelClient } from "../../";
import {
  HubIModel, GlobalEventSubscription, GlobalEventSAS, GlobalEventType,
  SoftiModelDeleteEvent, HardiModelDeleteEvent, IModelCreatedEvent, ChangeSetCreatedEvent,
  NamedVersionCreatedEvent, IModelHubGlobalEvent, GetEventOperationType,
} from "../../";

import { TestConfig, TestUsers } from "../TestConfig";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";
chai.should();

function mockGetGlobalEvent(subscriptionId: string, eventBody: object, eventType?: string, timeout?: number, responseCode?: number, delay?: number) {
  if (!TestConfig.enableMocks)
    return;

  const headers = eventType ? { "content-type": eventType! } : {};
  let query = subscriptionId + "/messages/head";
  if (timeout)
    query += `?timeout=${timeout}`;
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", query);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath, eventBody, 1, {}, headers, responseCode, delay);
}

function mockPeekLockGlobalEvent(subscriptionId: string, eventBody: object, eventType?: string, timeout?: number, responseCode: number = 201, delay?: number) {
  if (!TestConfig.enableMocks)
    return;

  const headerLocationQuery = subscriptionId + "/messages/2/7da9cfd5-40d5-4bb1-8d64-ec5a52e1c547";
  const responseHeaderLocation = utils.defaultUrl + utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", headerLocationQuery);

  const headers = eventType ? {
    "content-type": eventType!,
    "location": responseHeaderLocation,
  } : {};
  let query = subscriptionId + "/messages/head";
  if (timeout)
    query += `?timeout=${timeout}`;
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", query);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, eventBody, 1, undefined, headers, responseCode, delay);
}

function mockDeleteLockedEvent(subscriptionId: string, responseCode: number = 200) {
  if (!TestConfig.enableMocks)
    return;
  const query = subscriptionId + "/messages/2/7da9cfd5-40d5-4bb1-8d64-ec5a52e1c547";
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", query);

  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath, undefined, 1, undefined, undefined, responseCode);
}

function mockCreateGlobalEventsSubscription(subscriptionId: string, eventTypes: GlobalEventType[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription");
  const requestResponse = ResponseBuilder.generatePostResponse<GlobalEventSubscription>(
    ResponseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
      new Map<string, any>([
        ["wsgId", Guid.createValue()],
        ["eventTypes", eventTypes],
        ["subscriptionId", subscriptionId],
      ])));
  const postBody = ResponseBuilder.generatePostBody<GlobalEventSubscription>(
    ResponseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
      new Map<string, any>([
        ["eventTypes", eventTypes],
        ["subscriptionId", subscriptionId],
      ])));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUpdateGlobalEventSubscription(wsgId: string, subscriptionId: string, eventTypes: GlobalEventType[]) {
  if (!TestConfig.enableMocks)
    return;

  const responseObject = ResponseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
    new Map<string, any>([
      ["wsgId", wsgId],
      ["eventTypes", eventTypes],
      ["subscriptionId", subscriptionId],
    ]));
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", wsgId);
  const requestResponse = ResponseBuilder.generatePostResponse<GlobalEventSubscription>(responseObject);
  const postBody = ResponseBuilder.generatePostBody<GlobalEventSubscription>(responseObject);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockDeleteGlobalEventsSubscription(wsgId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", wsgId);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

function mockGetGlobalEventSASToken() {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSAS");
  const responseObject = ResponseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS, new Map<string, any>([
    ["sasToken", "12345"],
    ["baseAddress", `${utils.defaultUrl}/sv1.1/Repositories/Global--Global/GlobalScope`]]));
  const requestResponse = ResponseBuilder.generatePostResponse<GlobalEventSAS>(responseObject);
  const postBody = ResponseBuilder.generatePostBody<HubIModel>(ResponseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS));
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

describe("iModelHub GlobalEventHandler", () => {
  let accessToken: AccessToken;
  let serviceAccountAccessToken: AccessToken;
  let globalEventSubscription: GlobalEventSubscription;
  let globalEventSas: GlobalEventSAS;
  let projectId: string;
  const imodelName = "imodeljs-clients GlobalEvents test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();
  const alctx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().disableBehaviorOption("DisableGlobalEvents");
      imodelHubClient.RequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }

    projectId = await utils.getProjectId(accessToken);
    serviceAccountAccessToken = await utils.login(TestUsers.serviceAccount1);
    accessToken = await utils.login();
    await utils.deleteIModelByName(accessToken, projectId, imodelName);
  });

  after(async () => {
    if (!TestConfig.enableMocks)
      return;

    await utils.deleteIModelByName(accessToken, projectId, imodelName);

    if (!TestConfig.enableMocks) {
      utils.getRequestBehaviorOptionsHandler().resetDefaultBehaviorOptions();
      imodelHubClient.RequestOptions().setCustomOptions(utils.getRequestBehaviorOptionsHandler().toCustomRequestOptions());
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should subscribe to Global Events", async () => {
    const eventTypesList: GlobalEventType[] = ["iModelCreatedEvent"];

    const id = Guid.createValue();
    mockCreateGlobalEventsSubscription(id, eventTypesList);

    globalEventSubscription = await imodelHubClient.GlobalEvents().Subscriptions().create(alctx, serviceAccountAccessToken, id, eventTypesList);
    chai.assert(globalEventSubscription);
    chai.assert(globalEventSubscription.eventTypes);
    chai.expect(globalEventSubscription.eventTypes!).to.be.deep.equal(eventTypesList);
  });

  it("should retrieve Global Event SAS token", async () => {
    mockGetGlobalEventSASToken();
    globalEventSas = await imodelHubClient.GlobalEvents().getSASToken(alctx, serviceAccountAccessToken);
  });

  it("should receive Global Event iModelCreatedEvent", async () => {
    await utils.createIModel(accessToken, imodelName, projectId);

    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${projectId}","iModelId":"${Guid.createValue()}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "iModelCreatedEvent");
    const event = await imodelHubClient.GlobalEvents().getEvent(alctx, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(IModelCreatedEvent);
  });

  it("should update Global Event subscription", async () => {
    const newEventTypesList: GlobalEventType[] = ["iModelCreatedEvent", "SoftiModelDeleteEvent", "HardiModelDeleteEvent", "ChangeSetCreatedEvent", "NamedVersionCreatedEvent"];
    mockUpdateGlobalEventSubscription(globalEventSubscription.wsgId, globalEventSubscription.subscriptionId!, newEventTypesList);

    globalEventSubscription.eventTypes = newEventTypesList;
    globalEventSubscription = await imodelHubClient.GlobalEvents().Subscriptions().update(alctx, serviceAccountAccessToken, globalEventSubscription);
    chai.assert(globalEventSubscription);
    chai.assert(globalEventSubscription.eventTypes);
    chai.expect(globalEventSubscription.eventTypes!).to.be.deep.equal(newEventTypesList);
  });

  it("should receive Global Event through listener", async () => {
    if (TestConfig.enableMocks) {
      mockGetGlobalEventSASToken();
      const requestResponse = JSON.parse('{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}');
      mockGetGlobalEvent(globalEventSubscription.wsgId, requestResponse, "SoftiModelDeleteEvent", 60);
      mockGetGlobalEvent(globalEventSubscription.wsgId, {}, undefined, 60, 204, 2000);
    }

    let receivedEventsCount = 0;
    const deleteListener = imodelHubClient.GlobalEvents().createListener(alctx, async () => {
      return await utils.login(TestUsers.serviceAccount1);
    }, globalEventSubscription.wsgId, (receivedEvent: IModelHubGlobalEvent) => {
      if (receivedEvent instanceof SoftiModelDeleteEvent)
        receivedEventsCount++;
    });

    await utils.deleteIModelByName(accessToken, projectId, imodelName);

    let timeoutCounter = 0;
    for (; timeoutCounter < 100; ++timeoutCounter) {
      if (receivedEventsCount === 1)
        break;
      await new Promise((resolve) => setTimeout(resolve, TestConfig.enableMocks ? 1 : 100));
    }
    deleteListener();
    chai.expect(timeoutCounter).to.be.lessThan(100);
  });

  it("should receive Global Event with Peek-lock", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${projectId}","iModelId":"${Guid.createValue()}"}`;
    mockPeekLockGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "iModelCreatedEvent");
    const lockedEvent = await imodelHubClient.GlobalEvents().getEvent(alctx, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId, undefined, GetEventOperationType.Peek);

    mockDeleteLockedEvent(globalEventSubscription.wsgId);
    const deleted = await lockedEvent!.delete(alctx);
    chai.expect(deleted);
  });

  it("should receive Global Event SoftiModelDeleteEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "SoftiModelDeleteEvent");

    const event = await imodelHubClient.GlobalEvents().getEvent(alctx, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(SoftiModelDeleteEvent);
  });

  it("should receive Global Event HardiModelDeleteEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "HardiModelDeleteEvent");

    const event = await imodelHubClient.GlobalEvents().getEvent(alctx, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(HardiModelDeleteEvent);
  });

  it("should receive Global Event ChangeSetCreatedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789","BriefcaseId":2,"ChangeSetId":"369","ChangeSetIndex":"1"}';
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "ChangeSetCreatedEvent");

    const event = await imodelHubClient.GlobalEvents().getEvent(alctx, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(ChangeSetCreatedEvent);
  });

  it("should receive Global Event NamedVersionCreatedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789","ChangeSetId":"369","VersionId":"159","VersionName":"357"}';
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "NamedVersionCreatedEvent");

    const event = await imodelHubClient.GlobalEvents().getEvent(alctx, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(NamedVersionCreatedEvent);
  });

  it("should delete Global Event subscription by InstanceId", async () => {
    mockDeleteGlobalEventsSubscription(globalEventSubscription.wsgId);
    await imodelHubClient.GlobalEvents().Subscriptions().delete(alctx, serviceAccountAccessToken, globalEventSubscription.wsgId);
  });
});
