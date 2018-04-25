import * as chai from "chai";
import { TileDataAccessClient, InstanceData } from "../TileDataAccessClient";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig, TestUsers } from "./TestConfig";

describe("TileDataAccessClient", () => {

  let accessToken: AccessToken;
  const tileDataAccessClient = new TileDataAccessClient("QA");

  before(async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login(TestUsers.user3);
    accessToken = await tileDataAccessClient.getAccessToken(authToken);
  });

  it("should setup its URLs", async () => {
    let url: string = await new TileDataAccessClient("DEV").getUrl(true);
    chai.expect(url).equals("https://dev-connect-tilesdataaccess.bentley.com");

    url = await new TileDataAccessClient("QA").getUrl(true);
    chai.expect(url).equals("https://qa-connect-tilesdataaccess.bentley.com");

    url = await new TileDataAccessClient("PROD").getUrl(true);
    chai.expect(url).equals("https://connect-tilesdataaccess.bentley.com");

    url = await new TileDataAccessClient("PERF").getUrl(true);
    chai.expect(url).equals("https://perf-connect-tilesdataaccess.bentley.com");
  });

  it("should be able to retrieve property data properties", async () => {
    const tileDataAccessData: InstanceData[] = await tileDataAccessClient.getPropertyData(accessToken, "e9987eb3-c3a1-43b6-a368-e36876ad8e47", "2199023255773");
    chai.assert(tileDataAccessData);
  });

});
