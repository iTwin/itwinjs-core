/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as utils from "./TestUtils";

import { TestConfig } from "../TestConfig";

import { Guid } from "@bentley/bentleyjs-core";
import { EventSubscription, CodeEvent, EventSAS, EventType, IModelHubEvent } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
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

function mockGetEventSASToken(imodelId: string) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "EventSAS");
  const responseObject = ResponseBuilder.generateObject<EventSAS>(EventSAS,
    new Map<string, any>([
      ["sasToken", Guid.createValue()],
      ["baseAddress", `${utils.defaultUrl}/v2.5/Repositories/iModel--${imodelId}/iModelScope`],
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
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();

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

    subscription = await imodelHubClient.Events().Subscriptions().create(accessToken, iModelId, eventTypes);
    chai.expect(subscription);
  });

  it("should fail getting SAS token with invalid accessToken", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    let error;
    try {
      await imodelHubClient.Events().getSASToken(new utils.MockAccessToken(), iModelId);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status === 401);
  });

  it("should get SAS token", async () => {
    mockGetEventSASToken(iModelId);
    sasToken = await imodelHubClient.Events().getSASToken(accessToken, iModelId);
    chai.assert(sasToken);
  });

  it("should fail receiving event with invalid SAS token", async () => {
    mockGetEvent(iModelId, subscription.wsgId, {}, undefined, undefined, 401);
    let error;
    try {
      await imodelHubClient.Events().getEvent("InvalidSASToken", sasToken.baseAddress!, subscription.wsgId);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status === 401);
  });

  it("should fail receiving event with invalid subscription id", async () => {
    mockGetEvent(iModelId, "InvalidSubscriptionId", {}, undefined, undefined, 404);
    let error;
    try {
      await imodelHubClient.Events().getEvent(sasToken.sasToken!, sasToken.baseAddress!, "InvalidSubscriptionId");
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status === 404);
  });

  it("should reject when no event is available", async () => {
    mockGetEvent(iModelId, subscription.wsgId, {}, undefined, undefined, 204);
    let error;
    try {
      await imodelHubClient.Events().getEvent(sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);
    } catch (err) {
      error = err;
    }
    chai.assert(error);
    chai.expect(error.status === 204);
  });

  it("should receive code event", async () => {
    const codes = [utils.randomCode(briefcaseId)];
    if (!TestConfig.enableMocks) {
      await imodelHubClient.Codes().update(accessToken, iModelId, codes);
    } else {
      const requestResponse = '{"EventTopic":"123","FromEventSubscriptionId":"456","ToEventSubscriptionId":"","BriefcaseId":1,"CodeScope":"0X100000000FF","CodeSpecId":"0xff","State":1,"Values":["TestCode"]}';
      mockGetEvent(iModelId, subscription.wsgId, JSON.parse(requestResponse), "CodeEvent");
    }

    const event = await imodelHubClient.Events().getEvent(sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId);

    chai.expect(event).instanceof(CodeEvent);
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
    const deleteListener = imodelHubClient.Events().createListener(async () => {
      return await utils.login();
    }, subscription.wsgId, iModelId, (receivedEvent: IModelHubEvent) => { if (receivedEvent instanceof CodeEvent) receivedEventsCount++; });

    if (!TestConfig.enableMocks) {
      await imodelHubClient.Codes().update(accessToken, iModelId, [codes[0]]);
      await imodelHubClient.Codes().update(accessToken, iModelId, [codes[1]]);
    }

    let timeoutCounter = 0;
    for (; timeoutCounter < 100; ++timeoutCounter) {
      if (receivedEventsCount === 2)
        break;
      await new Promise((resolve) => setTimeout(resolve, TestConfig.enableMocks ? 1 : 100));
    }
    deleteListener();
    chai.expect(timeoutCounter < 100);
  });

  it("should delete subscription", async () => {
    mockDeleteEventSubscription(iModelId, subscription.wsgId);
    await imodelHubClient.Events().Subscriptions().delete(accessToken, iModelId, subscription.wsgId);
  });
});
