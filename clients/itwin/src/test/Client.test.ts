/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Client } from "../Client";
import { expect } from "chai";
import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";

class TestApiClient extends Client {
  public constructor() {
    super();
    this.baseUrl = "https://api.bentley.com/test-api";
  }

  protected getUrlSearchKey(): string {
    return "Test_API";
  }
}

describe("Client", () => {
  let client: TestApiClient;

  beforeEach(() => {
    client = new TestApiClient();
  });

  it("should not apply prefix without config entry", async () => {
    const requestContext = new ClientRequestContext();
    const url = await client.getUrl(requestContext);
    expect(url).to.equal("https://api.bentley.com/test-api");
  });

  it("should apply prefix with config entry", async () => {
    Config.App.set("imjs_url_prefix", "test-");
    const requestContext = new ClientRequestContext();
    const url = await client.getUrl(requestContext);
    expect(url).to.equal("https://test-api.bentley.com/test-api");
    Config.App.remove("imjs_url_prefix");
  });
});
