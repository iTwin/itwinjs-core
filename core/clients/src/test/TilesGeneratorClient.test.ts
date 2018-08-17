/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient } from "../ConnectClients";
import { TilesGeneratorClient, Job } from "../TilesGeneratorClient";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { RequestQueryOptions } from "../Request";
import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";

chai.should();

export class TilesGeneratorUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-3dtilesgenerator.bentley.com",
    QA: "https://qa-3dtilesgenerator.bentley.com",
    PROD: "https://3dtilesgenerator.bentley.com",
    PERF: "https://perf-3dtilesgenerator.bentley.com",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(TilesGeneratorClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("TilesGeneratorClient", () => {
  let accessToken: AccessToken;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const tilesGeneratorClient: TilesGeneratorClient = new TilesGeneratorClient(TestConfig.deploymentEnv);
  let projectId: string;
  let iModelId: string;
  let versionId: string;

  before(async () => {
    if (TestConfig.enableMocks)
      return;

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);

    const { project, iModel, version } = await TestConfig.queryTestCase(accessToken, TestConfig.deploymentEnv, "Hackathon", "Demo - ChangeSets", "First stage");

    projectId = project.wsgId;
    chai.expect(projectId);

    iModelId = iModel!.wsgId;
    chai.expect(iModelId);

    versionId = version!.wsgId;
    chai.expect(versionId);

    // Update access token to that for TilesGeneratorClient
    accessToken = await tilesGeneratorClient.getAccessToken(authToken);
  });

  it("should setup its URLs", async () => {
    TilesGeneratorUrlMock.mockGetUrl("DEV");
    let url: string = await new TilesGeneratorClient("DEV").getUrl(true);
    chai.expect(url).equals("https://dev-3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("QA");
    url = await new TilesGeneratorClient("QA").getUrl(true);
    chai.expect(url).equals("https://qa-3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("PROD");
    url = await new TilesGeneratorClient("PROD").getUrl(true);
    chai.expect(url).equals("https://3dtilesgenerator.bentley.com");

    TilesGeneratorUrlMock.mockGetUrl("PERF");
    url = await new TilesGeneratorClient("PERF").getUrl(true);
    chai.expect(url).equals("https://perf-3dtilesgenerator.bentley.com");
  });

  it("should be able to retrieve a tile generator job", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // The service can be queried ONLY by single instance ID filter.
    const instanceId: string = `${projectId}--${iModelId}--${versionId}`;
    const queryOptions: RequestQueryOptions = {
      $select: "*",
      $filter: `$id+eq+'${instanceId}'`,
    };

    const job: Job = await tilesGeneratorClient.getJob(accessToken, queryOptions);
    // console.log(JSON.stringify(job));

    chai.assert(job);
    chai.expect(job.contextId).equals(projectId);
    chai.expect(job.documentId).equals(iModelId);
    chai.expect(job.versionId).equals(versionId);
    chai.expect(job.dataId).equals("6541fcb4-d1fa-4c58-8385-d73c9459d6d6");
    chai.expect(job.tilesId).equals("8ee4458a-53e2-46c3-af7c-e2a1cd5b08d1");
    chai.expect(job.wsgId).equals(instanceId);
  });

  it("should be able to generate the URL to view an imodel in Web Navigator", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const url: string = await tilesGeneratorClient.buildWebNavigatorUrl(accessToken, projectId, iModelId, versionId);
    chai.expect(url).equals("https://qa-connect-imodelweb.bentley.com/?id=8ee4458a-53e2-46c3-af7c-e2a1cd5b08d1&projectId=52d1633d-88a1-404d-a060-98d70f777db4&dataId=6541fcb4-d1fa-4c58-8385-d73c9459d6d6");
    // https://qa-connect-imodelweb.bentley.com/?id=<tilesId>&projectId=<projectId>&dataId=<dataId>
  });

});
