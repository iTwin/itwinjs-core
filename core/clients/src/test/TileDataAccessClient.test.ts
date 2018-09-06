import * as chai from "chai";
import { TileDataAccessClient, InstanceData } from "../TileDataAccessClient";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig, TestUsers } from "./TestConfig";
import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

export class TilesDataUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-tilesdataaccess.bentley.com",
    QA: "https://qa-connect-tilesdataaccess.bentley.com",
    PROD: "https://connect-tilesdataaccess.bentley.com",
    PERF: "https://perf-connect-tilesdataaccess.bentley.com",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(TileDataAccessClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("TileDataAccessClient", () => {

  let accessToken: AccessToken;
  const tileDataAccessClient = new TileDataAccessClient("QA");
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login(TestUsers.user3);
    accessToken = await tileDataAccessClient.getAccessToken(actx, authToken);
  });

  it("should setup its URLs", async () => {
    TilesDataUrlMock.mockGetUrl("DEV");
    let url: string = await new TileDataAccessClient("DEV").getUrl(actx, true);
    chai.expect(url).equals("https://dev-connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("QA");
    url = await new TileDataAccessClient("QA").getUrl(actx, true);
    chai.expect(url).equals("https://qa-connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("PROD");
    url = await new TileDataAccessClient("PROD").getUrl(actx, true);
    chai.expect(url).equals("https://connect-tilesdataaccess.bentley.com");

    TilesDataUrlMock.mockGetUrl("PERF");
    url = await new TileDataAccessClient("PERF").getUrl(actx, true);
    chai.expect(url).equals("https://perf-connect-tilesdataaccess.bentley.com");
  });

  it("should be able to retrieve property data properties", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const tileDataAccessData: InstanceData[] = await tileDataAccessClient.getPropertyData(actx, accessToken, "e9987eb3-c3a1-43b6-a368-e36876ad8e47", "2199023255773");
    chai.assert(tileDataAccessData);
  });

});
