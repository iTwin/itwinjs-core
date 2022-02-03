/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { HttpServerRequest, HttpServerResponse } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import * as request from "supertest";
import { FakeBentleyCloudRpcConfiguration, TestIModelJsExpressServer } from "./Mocks";

// Returns fake response for specified mock's method
function mockRequestHandler(mock: sinon.SinonMock, method: string, status: number, result: string) {
  return mock.expects(method).callsFake(
    (_req: HttpServerRequest, res: HttpServerResponse) => {
      res.status(status).send(result);
    });
}

describe("IModelJsExpressServer", () => {
  let protocolMock: sinon.SinonMock;
  let testServer: TestIModelJsExpressServer;

  beforeEach(async () => {
    const rpcConfiguration = new FakeBentleyCloudRpcConfiguration();
    testServer = new TestIModelJsExpressServer(rpcConfiguration.protocol);
    await testServer.initialize(3000);
    protocolMock = sinon.mock(rpcConfiguration.protocol);
  });

  afterEach(async () => {
    protocolMock.restore();
  });

  it("should respond to ping", async () => {
    await request(testServer.expressApp)
      .get("/ping")
      .expect(200)
      .expect("Success");
  });

  it("should properly handle swagger.json GET requests", async () => {
    const mockStatus = 200;
    const mockResult = "swaggerResult";
    const spy = mockRequestHandler(protocolMock, "handleOpenApiDescriptionRequest", mockStatus, mockResult);

    await request(testServer.expressApp)
      .get("/v3/swagger.json")
      .expect(mockStatus)
      .expect(mockResult);

    expect(spy.calledOnce).to.be.true;
  });

  it("should properly handle POST requests", async () => {
    const mockStatus = 200;
    const mockResult = "mockPostResult";
    const spy = mockRequestHandler(protocolMock, "handleOperationPostRequest", mockStatus, mockResult);
    await request(testServer.expressApp)
      .post("/foo")
      .expect(mockStatus)
      .expect(mockResult);

    expect(spy.calledOnce).to.be.true;
  });
});
