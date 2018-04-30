/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig, TestUsers } from "../TestConfig";

import { IModel, GlobalEventSubscription, GlobalEventSAS, SoftiModelDeleteEvent, HardiModelDeleteEvent, IModelCreatedEvent, ChangeSetCreatedEvent, NamedVersionCreatedEvent } from "../../imodelhub";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { AzureFileHandler } from "../../imodelhub/AzureFileHandler";
import * as utils from "./TestUtils";

chai.should();

describe("iModelHub GlobalEventHandler", () => {
  let accessToken: AccessToken;
  let serviceAccountAccessToken: AccessToken;
  let globalEventSubscription: GlobalEventSubscription;
  let globalEventSas: GlobalEventSAS;
  let projectId: string;
  const imodelHubClient: IModelHubClient = new IModelHubClient(TestConfig.deploymentEnv, new AzureFileHandler());
  const downloadToPath: string = __dirname + "/../assets/";
  const responseBuilder: ResponseBuilder = new ResponseBuilder();

  function shouldRun(): boolean {
    return (TestConfig.enableMocks || TestConfig.deploymentEnv === "DEV");
  }

  before(async function(this: Mocha.IHookCallbackContext) {
    if (!shouldRun())
      this.skip();

    projectId = await utils.getProjectId();
    serviceAccountAccessToken = await utils.login(TestUsers.serviceAccount1);
    accessToken = await utils.login();
    await utils.deleteIModelByName(accessToken, projectId, "GlobalEventTestModel");
  });

  after(async () => {
    if (shouldRun())
      await utils.deleteIModelByName(accessToken, projectId, "GlobalEventTestModel");
  });

  afterEach(() => {
    responseBuilder.clearMocks();
  });

  it("should subscribe to Global Events", async () => {
    const eventTypesList = ["iModelCreatedEvent", "SoftiModelDeleteEvent", "HardiModelDeleteEvent", "ChangeSetCreatedEvent", "NamedVersionCreatedEvent"];
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription");
    const requestResponse = responseBuilder.generatePostResponse<GlobalEventSubscription>(responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
                                            new Map<string, any>([["wsgId", "12345"], ["eventTypes", eventTypesList], ["subscriptionId", "00000000-0000-0000-0000-000000000000"]])));
    const postBody = responseBuilder.generatePostBody<GlobalEventSubscription>(responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
                                                        new Map<string, any>([["eventTypes", eventTypesList], ["subscriptionId", "00000000-0000-0000-0000-000000000000"]])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    globalEventSubscription = await imodelHubClient.GlobalEvents().Subscriptions().create(serviceAccountAccessToken, "00000000-0000-0000-0000-000000000000", ["iModelCreatedEvent", "SoftiModelDeleteEvent", "HardiModelDeleteEvent", "ChangeSetCreatedEvent", "NamedVersionCreatedEvent"]);
    chai.expect(globalEventSubscription.eventTypes!).to.deep.equal(eventTypesList);
  });

  it("should retrieve Global Event SAS token", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "GlobalEventSAS");
    const responseObject = responseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS, new Map<string, any>([
                    ["sasToken", "12345"],
                    ["baseAddres", "https://qa-imodelhubapi.bentley.com/v2.5/Repositories/Global--Global/GlobalScope"]]));
    const requestResponse = responseBuilder.generatePostResponse<GlobalEventSAS>(responseObject);
    const postBody = responseBuilder.generatePostBody<IModel>(responseBuilder.generateObject<GlobalEventSAS>(GlobalEventSAS));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);
    globalEventSas = await imodelHubClient.GlobalEvents().getSASToken(serviceAccountAccessToken);
  });

  it("should receive Global Event iModelCreatedEvent", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "Subscriptions", globalEventSubscription.wsgId + "/messages/head");
    const requestResponse = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    responseBuilder.MockResponse(RequestType.Delete, requestPath, requestResponse, 1, "", {"content-type": "iModelCreatedEvent"});
    if (!TestConfig.enableMocks) {
      // Actual iModel create event
      const iModel = await imodelHubClient.IModels().create(accessToken, projectId, "GlobalEventTestModel", downloadToPath + "TestModel/iModelHubTestSeedFile.bim");
      await imodelHubClient.IModels().delete(accessToken, projectId, iModel.wsgId);
    }

    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(IModelCreatedEvent);
  });

  it("should receive Global Event SoftiModelDeleteEvent", async function(this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "Subscriptions", globalEventSubscription.wsgId + "/messages/head");
    const requestResponse = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    responseBuilder.MockResponse(RequestType.Delete, requestPath, requestResponse, 1, "", {"content-type": "SoftiModelDeleteEvent"});
    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(SoftiModelDeleteEvent);
  });

  it("should receive Global Event HardiModelDeleteEvent", async function(this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "Subscriptions", globalEventSubscription.wsgId + "/messages/head");
    const requestResponse = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789"}';
    responseBuilder.MockResponse(RequestType.Delete, requestPath, requestResponse, 1, "", {"content-type": "HardiModelDeleteEvent"});
    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(HardiModelDeleteEvent);
  });

  it("should receive Global Event ChangeSetCreatedEvent", async function(this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "Subscriptions", globalEventSubscription.wsgId + "/messages/head");
    const requestResponse = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789","BriefcaseId":2,"ChangeSetId":"369","ChangeSetIndex":"1"}';
    responseBuilder.MockResponse(RequestType.Delete, requestPath, requestResponse, 1, "", {"content-type": "ChangeSetCreatedEvent"});
    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(ChangeSetCreatedEvent);
  });

  it("should update Global Event subscription", async () => {
    const newEventTypesList = ["NamedVersionCreatedEvent"];
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", globalEventSubscription.wsgId);
    const requestResponse = responseBuilder.generatePostResponse<GlobalEventSubscription>(responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
                                            new Map<string, any>([["wsgId", globalEventSubscription.wsgId], ["eventTypes", newEventTypesList], ["subscriptionId", "00000000-0000-0000-0000-000000000000"]])));
    const postBody = responseBuilder.generatePostBody<GlobalEventSubscription>(responseBuilder.generateObject<GlobalEventSubscription>(GlobalEventSubscription,
                                                        new Map<string, any>([["wsgId", globalEventSubscription.wsgId], ["eventTypes", newEventTypesList], ["subscriptionId", "00000000-0000-0000-0000-000000000000"]])));
    responseBuilder.MockResponse(RequestType.Post, requestPath, requestResponse, 1, postBody);

    globalEventSubscription.eventTypes = ["NamedVersionCreatedEvent"];
    globalEventSubscription = await imodelHubClient.GlobalEvents().Subscriptions().update(serviceAccountAccessToken, globalEventSubscription);
    chai.expect(globalEventSubscription.eventTypes!).to.deep.equal(newEventTypesList);
  });

  it("should receive Global Event NamedVersionCreatedEvent", async function(this: Mocha.ITestCallbackContext) {
    if (!TestConfig.enableMocks)
      this.skip();

    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "Subscriptions", globalEventSubscription.wsgId + "/messages/head");
    const requestResponse = '{"EventTopic":"iModelHubGlobalEvents","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","ProjectId":"123456","iModelId":"789","ChangeSetId":"369","VersionId":"159","VersionName":"357"}';
    responseBuilder.MockResponse(RequestType.Delete, requestPath, requestResponse, 1, "", {"content-type": "NamedVersionCreatedEvent"});
    const event = await imodelHubClient.GlobalEvents().getEvent(globalEventSas.sasToken!, globalEventSas.baseAddres!, globalEventSubscription.wsgId);

    chai.expect(event).instanceof(NamedVersionCreatedEvent);
  });

  it("should delete Global Event subscription by InstanceId", async () => {
    const requestPath = responseBuilder.createRequestUrl(ScopeType.Global, "", "GlobalEventSubscription", globalEventSubscription.wsgId);
    responseBuilder.MockResponse(RequestType.Delete, requestPath, "");
    await imodelHubClient.GlobalEvents().Subscriptions().delete(serviceAccountAccessToken, globalEventSubscription.wsgId);
  });

});
