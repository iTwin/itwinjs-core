/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Config, Guid } from "@bentley/bentleyjs-core";
import { ContextType } from "@bentley/context-registry-client";
import {
  ChangeSetCreatedEvent, GetEventOperationType, GlobalCheckpointCreatedEvent, GlobalEventSAS, GlobalEventSubscription, GlobalEventType, HardiModelDeleteEvent, HubIModel,
  IModelClient, IModelCreatedEvent, IModelHubGlobalEvent, NamedVersionCreatedEvent, SoftiModelDeleteEvent,
} from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUserCredentials } from "@bentley/oidc-signin-tool";
import { RequestType, ResponseBuilder, ScopeType } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";

chai.should();

function mockGetGlobalEvent(subscriptionId: string, eventBody: object, eventType?: string, timeout?: number, responseCode?: number, delay?: number) {
  if (!TestConfig.enableMocks)
    return;

  const headers = eventType ? { "content-type": eventType } : {};
  let query = `${subscriptionId}/messages/head`;
  if (timeout)
    query += `?timeout=${timeout}`;
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", query);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath, eventBody, 1, {}, headers, responseCode, delay);
}

function mockPeekLockGlobalEvent(subscriptionId: string, eventBody: object, eventType?: string, timeout?: number, responseCode: number = 201, delay?: number) {
  if (!TestConfig.enableMocks)
    return;

  const headerLocationQuery = `${subscriptionId}/messages/2/7da9cfd5-40d5-4bb1-8d64-ec5a52e1c547`;
  const responseHeaderLocation = utils.IModelHubUrlMock.getUrl() + utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", headerLocationQuery);

  const headers = eventType ? {
    "content-type": eventType,
    "location": responseHeaderLocation,
  } : {};
  let query = `${subscriptionId}/messages/head`;
  if (timeout)
    query += `?timeout=${timeout}`;
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", query);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, eventBody, 1, undefined, headers, responseCode, delay);
}

function mockDeleteLockedEvent(subscriptionId: string, responseCode: number = 200) {
  if (!TestConfig.enableMocks)
    return;
  const query = `${subscriptionId}/messages/2/7da9cfd5-40d5-4bb1-8d64-ec5a52e1c547`;
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", query);

  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath, undefined, 1, undefined, undefined, responseCode);
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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
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
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockDeleteGlobalEventsSubscription(wsgId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", wsgId);
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Delete, requestPath);
}

function mockGetGlobalEventSASToken() {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSAS");
  const responseObject = ResponseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS, new Map<string, any>([
    ["sasToken", "12345"],
    ["baseAddress", `${utils.IModelHubUrlMock.getUrl()}/sv1.1/Repositories/Global--Global/GlobalScope`]]));
  const requestResponse = ResponseBuilder.generatePostResponse<GlobalEventSAS>(responseObject);
  const postBody = ResponseBuilder.generatePostBody<HubIModel>(ResponseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS));
  ResponseBuilder.mockResponse(utils.IModelHubUrlMock.getUrl(), RequestType.Post, requestPath, requestResponse, 1, postBody);
}

describe("iModelHub GlobalEventHandler (#unit)", () => {
  let globalEventSubscription: GlobalEventSubscription;
  let globalEventSas: GlobalEventSAS;
  let projectId: string;
  const imodelName = "imodeljs-clients GlobalEvents test";
  const imodelHubClient: IModelClient = utils.getDefaultClient();
  let requestContext: AuthorizedClientRequestContext;
  let serviceAccountRequestContext: AuthorizedClientRequestContext;
  let serviceAccount1: TestUserCredentials;

  before(async () => {
    const accessToken: AccessToken = await utils.login();
    requestContext = new AuthorizedClientRequestContext(accessToken);
    projectId = await utils.getProjectId(requestContext);

    serviceAccount1 = {
      email: Config.App.getString("imjs_test_serviceAccount1_user_name"),
      password: Config.App.getString("imjs_test_serviceAccount1_user_password"),
    };
    const serviceAccountAccessToken = await utils.login(serviceAccount1);
    serviceAccountRequestContext = new AuthorizedClientRequestContext(serviceAccountAccessToken);

    await utils.deleteIModelByName(requestContext, projectId, imodelName);
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should subscribe to Global Events", async () => {
    const eventTypesList: GlobalEventType[] = ["iModelCreatedEvent"];

    const id = Guid.createValue();
    mockCreateGlobalEventsSubscription(id, eventTypesList);

    globalEventSubscription = await imodelHubClient.globalEvents.subscriptions.create(serviceAccountRequestContext, id, eventTypesList);
    chai.assert(globalEventSubscription);
    chai.assert(globalEventSubscription.eventTypes);
    chai.expect(globalEventSubscription.eventTypes!).to.be.deep.equal(eventTypesList);
  });

  it("should retrieve Global Event SAS token", async () => {
    mockGetGlobalEventSASToken();
    globalEventSas = await imodelHubClient.globalEvents.getSASToken(serviceAccountRequestContext);
  });

  it("should receive Global Event iModelCreatedEvent", async () => {
    await utils.createIModel(requestContext, imodelName, projectId);

    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${projectId}","ContextId":"${projectId}","ContextTypeId":${ContextType.Project},"iModelId":"${Guid.createValue()}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "iModelCreatedEvent");
    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(IModelCreatedEvent);
    chai.assert(!!event!.iModelId);
    chai.expect(event!.contextId).to.be.eq(projectId);
    chai.expect(event!.contextTypeId).to.be.eq(ContextType.Project);
  });

  it("should update Global Event subscription", async () => {
    const newEventTypesList: GlobalEventType[] = ["iModelCreatedEvent", "SoftiModelDeleteEvent", "HardiModelDeleteEvent", "ChangeSetCreatedEvent", "NamedVersionCreatedEvent"];
    mockUpdateGlobalEventSubscription(globalEventSubscription.wsgId, globalEventSubscription.subscriptionId!, newEventTypesList);

    globalEventSubscription.eventTypes = newEventTypesList;
    globalEventSubscription = await imodelHubClient.globalEvents.subscriptions.update(serviceAccountRequestContext, globalEventSubscription);
    chai.assert(globalEventSubscription);
    chai.assert(globalEventSubscription.eventTypes);
    chai.expect(globalEventSubscription.eventTypes!).to.be.deep.equal(newEventTypesList);
  });

  it("should receive Global Event through listener", async () => {
    if (TestConfig.enableMocks) {
      mockGetGlobalEventSASToken();
      const requestResponse = JSON.parse(`{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}"}`);
      mockGetGlobalEvent(globalEventSubscription.wsgId, requestResponse, "SoftiModelDeleteEvent", 60);
      mockGetGlobalEvent(globalEventSubscription.wsgId, {}, undefined, 60, 204, 2000);
    }

    let receivedEventsCount = 0;
    const deleteListener = imodelHubClient.globalEvents.createListener(requestContext, async () => {
      return utils.login(serviceAccount1);
    }, globalEventSubscription.wsgId, (receivedEvent: IModelHubGlobalEvent) => {
      if (receivedEvent instanceof SoftiModelDeleteEvent)
        receivedEventsCount++;
    });

    await utils.deleteIModelByName(requestContext, projectId, imodelName);

    let timeoutCounter = 0;
    for (; timeoutCounter < 100; ++timeoutCounter) {
      if (receivedEventsCount === 1)
        break;
      await new Promise((resolve) => setTimeout(resolve, TestConfig.enableMocks ? 1 : 100));
    }
    deleteListener();
    chai.expect(timeoutCounter).to.be.lessThan(100);
  });

  it("should receive Global Event with Peek-lock (#unit)", async () => {
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${projectId}","iModelId":"${Guid.createValue()}"}`;
    mockPeekLockGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "iModelCreatedEvent");
    const lockedEvent = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId, undefined, GetEventOperationType.Peek);

    mockDeleteLockedEvent(globalEventSubscription.wsgId);
    const deleted = await lockedEvent!.delete(requestContext);
    chai.expect(deleted);
  });

  it("should receive Global Event SoftiModelDeleteEvent (#unit)", async () => {
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "SoftiModelDeleteEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(SoftiModelDeleteEvent);
    chai.assert(!!event!.iModelId);
  });

  it("should receive Global Event HardiModelDeleteEvent (#unit)", async () => {
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "HardiModelDeleteEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(HardiModelDeleteEvent);
    chai.assert(!!event!.iModelId);
  });

  it("should receive Global Event ChangeSetCreatedEvent (#unit)", async () => {
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}","BriefcaseId":2,"ChangeSetId":"369","ChangeSetIndex":"1"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "ChangeSetCreatedEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(ChangeSetCreatedEvent);
    chai.assert(!!event!.iModelId);
  });

  it("should receive Global Event baseline NamedVersionCreatedEvent (#unit)", async () => {
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}","ChangeSetId":"","VersionId":"${Guid.createValue()}","VersionName":"357"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "NamedVersionCreatedEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(NamedVersionCreatedEvent);
    chai.assert(!!event!.iModelId);
    const typedEvent = event as NamedVersionCreatedEvent;
    chai.assert(!!typedEvent);
    chai.assert(!!typedEvent.versionId);
    chai.expect(typedEvent.changeSetId).to.be.eq("");
  });

  it("should receive Global Event NamedVersionCreatedEvent (#unit)", async () => {
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}","ChangeSetId":"369","VersionId":"${Guid.createValue()}","VersionName":"357"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "NamedVersionCreatedEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(NamedVersionCreatedEvent);
    chai.assert(!!event!.iModelId);
    const typedEvent = event as NamedVersionCreatedEvent;
    chai.assert(!!typedEvent);
    chai.assert(!!typedEvent.versionId);
  });

  it("should receive Global Event CheckpointCreatedEvent (#unit)", async () => {
    const versionId: string = Guid.createValue();
    const changeSetId: string = "changeSetId";
    const changeSetIndex: string = "5";
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}","VersionId":"${versionId}","ChangeSetId":"${changeSetId}","ChangeSetIndex":"${changeSetIndex}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "CheckpointCreatedEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(GlobalCheckpointCreatedEvent);
    chai.assert(!!event!.iModelId);
    const typedEvent = event as GlobalCheckpointCreatedEvent;
    chai.assert(!!typedEvent);
    chai.expect(typedEvent.versionId).to.be.equal(versionId);
    chai.expect(typedEvent.changeSetId).to.be.eq(changeSetId);
    chai.expect(typedEvent.changeSetIndex).to.be.eq(changeSetIndex);
  });

  it("should receive Global Event CheckpointCreatedEvent without Version (#unit)", async () => {
    const changeSetId: string = "changeSetId";
    const changeSetIndex: string = "5";
    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${Guid.createValue()}","iModelId":"${Guid.createValue()}","ChangeSetId":"${changeSetId}","ChangeSetIndex":"${changeSetIndex}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "CheckpointCreatedEvent");

    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(GlobalCheckpointCreatedEvent);
    chai.assert(!!event!.iModelId);
    const typedEvent = event as GlobalCheckpointCreatedEvent;
    chai.assert(!!typedEvent);
    chai.expect(!typedEvent.versionId);
    chai.expect(typedEvent.changeSetId).to.be.eq(changeSetId);
    chai.expect(typedEvent.changeSetIndex).to.be.eq(changeSetIndex);
  });

  it("should delete Global Event subscription by InstanceId", async () => {
    mockDeleteGlobalEventsSubscription(globalEventSubscription.wsgId);
    await imodelHubClient.globalEvents.subscriptions.delete(serviceAccountRequestContext, globalEventSubscription.wsgId);
  });

  it("should receive Global Event iModelCreatedEvent from Asset", async () => {
    const assetId = await utils.getAssetId(requestContext, undefined);
    await utils.createIModel(requestContext, imodelName, assetId);

    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${assetId}","ContextId":"${assetId}","ContextTypeId":${ContextType.Asset},"iModelId":"${Guid.createValue()}"}`;
    mockGetGlobalEvent(globalEventSubscription.wsgId, JSON.parse(eventBody), "iModelCreatedEvent");
    const event = await imodelHubClient.globalEvents.getEvent(requestContext, globalEventSas.sasToken!, globalEventSas.baseAddress!, globalEventSubscription.wsgId);

    chai.expect(event).to.be.instanceof(IModelCreatedEvent);
    chai.assert(!!event!.iModelId);
    chai.expect(event!.contextId).to.be.eq(assetId);
    chai.expect(event!.contextTypeId).to.be.eq(ContextType.Asset);
  });
});
