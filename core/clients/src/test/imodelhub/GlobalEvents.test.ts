/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig, TestUsers } from "../TestConfig";

import { IModel, GlobalEventSubscription, GlobalEventSAS, GlobalEventType, SoftiModelDeleteEvent, HardiModelDeleteEvent, IModelCreatedEvent, ChangeSetCreatedEvent, NamedVersionCreatedEvent } from "../../imodelhub";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import * as utils from "./TestUtils";
import { Guid } from "@bentley/bentleyjs-core";

chai.should();

function mockGetGlobalEvent(responseBuilder: ResponseBuilder, subscriptionId: string, eventType: string, eventBody: object) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "Subscriptions", subscriptionId + "/messages/head");
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath, eventBody, 1, {}, { "content-type": eventType });
}

function mockCreateGlobalEventsSubscription(responseBuilder: ResponseBuilder, subscriptionId: string, eventTypes: GlobalEventType[]) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription");
  const requestResponse = responseBuilder.generatePostResponse<GlobalEventSubscription>(
    responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
      new Map<string, any>([
        ["wsgId", Guid.createValue()],
        ["eventTypes", eventTypes],
        ["subscriptionId", subscriptionId],
      ])));
  const postBody = responseBuilder.generatePostBody<GlobalEventSubscription>(
    responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
      new Map<string, any>([
        ["eventTypes", eventTypes],
        ["subscriptionId", subscriptionId],
      ])));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockUpdateGlobalEventSubscription(responseBuilder: ResponseBuilder, wsgId: string, subscriptionId: string, eventTypes: GlobalEventType[]) {
  if (!TestConfig.enableMocks)
    return;

  const responseObject = responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
    new Map<string, any>([
      ["wsgId", wsgId],
      ["eventTypes", eventTypes],
      ["subscriptionId", subscriptionId],
    ]));
  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", wsgId);
  const requestResponse = responseBuilder.generatePostResponse<GlobalEventSubscription>(responseObject);
  const postBody = responseBuilder.generatePostBody<GlobalEventSubscription>(responseObject);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

function mockDeleteGlobalEventsSubscription(responseBuilder: ResponseBuilder, wsgId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", wsgId);
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

function mockGetGlobalEventSASToken(responseBuilder: ResponseBuilder) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Global, "", "GlobalEventSAS");
  const responseObject = responseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS, new Map<string, any>([
    ["sasToken", "12345"],
    ["baseAddres", "https://qa-imodelhubapi.bentley.com/v2.5/Repositories/Global--Global/GlobalScope"]]));
  const requestResponse = responseBuilder.generatePostResponse<GlobalEventSAS>(responseObject);
  const postBody = responseBuilder.generatePostBody<IModel>(responseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS));
  responseBuilder.mockResponse(utils.defaultUrl, RequestType.Post, requestPath, requestResponse, 1, postBody);
}

describe("iModelHub GlobalEventHandler", () => {
  let accessToken: AccessToken;
  let serviceAccountAccessToken: AccessToken;
  let globalEventSubscription: GlobalEventSubscription;
  let globalEventSas: GlobalEventSAS;
  let projectId: string;
  const imodelName = "imodeljs-clients GlobalEvents test";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();
  const imodelHubClient: IModelHubClient = utils.getDefaultClient(responseBuilder);

  function shouldRun(): boolean {
    return (TestConfig.enableMocks || TestConfig.deploymentEnv === "DEV");
  }

  before(async function (this: Mocha.IHookCallbackContext) {
    if (!shouldRun())
      this.skip();

    projectId = await utils.getProjectId();
    serviceAccountAccessToken = await utils.login(TestUsers.serviceAccount1);
    accessToken = await utils.login();
    await utils.deleteIModelByName(accessToken, projectId, imodelName);
  });

  after(async () => {
    if (shouldRun())
      await utils.deleteIModelByName(accessToken, projectId, imodelName);
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should subscribe to Global Events", async () => {
    const eventTypesList: GlobalEventType[] = ["iModelCreatedEvent", "SoftiModelDeleteEvent", "HardiModelDeleteEvent", "ChangeSetCreatedEvent", "NamedVersionCreatedEvent"];

    const id = Guid.createValue();
    mockCreateGlobalEventsSubscription(responseBuilder, id, eventTypesList);

    globalEventSubscription = await imodelHubClient.GlobalEvents().Subscriptions().create(serviceAccountAccessToken, id, ["iModelCreatedEvent", "SoftiModelDeleteEvent", "HardiModelDeleteEvent", "ChangeSetCreatedEvent", "NamedVersionCreatedEvent"]);
    chai.expect(globalEventSubscription.eventTypes!).to.deep.equal(eventTypesList);
  });

  it("should retrieve Global Event SAS token", async () => {
    mockGetGlobalEventSASToken(responseBuilder);
    globalEventSas = await imodelHubClient.GlobalEvents().getSASToken(serviceAccountAccessToken);
  });

  it("should receive Global Event iModelCreatedEvent", async () => {
    if (!TestConfig.enableMocks) {
      // Actual iModel create event
      utils.createIModel(accessToken, imodelName, projectId);
    }

    const eventBody = `{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"${Guid.createValue()}","ToEventSubscriptionId":"","ProjectId":"${projectId}","iModelId":"${Guid.createValue()}"}`;
    mockGetGlobalEvent(responseBuilder, globalEventSubscription.wsgId, "iModelCreatedEvent", JSON.parse(eventBody));
    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(IModelCreatedEvent);
  });

  it("should receive Global Event SoftiModelDeleteEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    mockGetGlobalEvent(responseBuilder, globalEventSubscription.wsgId, "SoftiModelDeleteEvent", JSON.parse(eventBody));

    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(SoftiModelDeleteEvent);
  });

  it("should receive Global Event HardiModelDeleteEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    mockGetGlobalEvent(responseBuilder, globalEventSubscription.wsgId, "HardiModelDeleteEvent", JSON.parse(eventBody));

    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(HardiModelDeleteEvent);
  });

  it("should receive Global Event ChangeSetCreatedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789","BriefcaseId":2,"ChangeSetId":"369","ChangeSetIndex":"1"}';
    mockGetGlobalEvent(responseBuilder, globalEventSubscription.wsgId, "ChangeSetCreatedEvent", JSON.parse(eventBody));

    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(ChangeSetCreatedEvent);
  });

  it("should update Global Event subscription", async () => {
    const newEventTypesList: GlobalEventType[] = ["NamedVersionCreatedEvent"];
    mockUpdateGlobalEventSubscription(responseBuilder, globalEventSubscription.wsgId, globalEventSubscription.subscriptionId!, newEventTypesList);

    globalEventSubscription.eventTypes = ["NamedVersionCreatedEvent"];
    globalEventSubscription = await imodelHubClient.GlobalEvents().Subscriptions().update(serviceAccountAccessToken, globalEventSubscription);
    chai.expect(globalEventSubscription.eventTypes!).to.deep.equal(newEventTypesList);
  });

  it("should receive Global Event NamedVersionCreatedEvent", async function (this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const eventBody = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789","ChangeSetId":"369","VersionId":"159","VersionName":"357"}';
    mockGetGlobalEvent(responseBuilder, globalEventSubscription.wsgId, "NamedVersionCreatedEvent", JSON.parse(eventBody));

    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(NamedVersionCreatedEvent);
  });

  it("should delete Global Event subscription by InstanceId", async () => {
    mockDeleteGlobalEventsSubscription(responseBuilder, globalEventSubscription.wsgId);
    await imodelHubClient.GlobalEvents().Subscriptions().delete(serviceAccountAccessToken, globalEventSubscription.wsgId);
  });
});
