/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Client } from "../Client";
import { expect } from "chai";

class TestApiClient extends Client {
  public constructor() {
    super();
    this.baseUrl = "https://api.bentley.com/test-api";
  }
}

describe("Client", () => {
  let client: TestApiClient;

  beforeEach(() => {
    client = new TestApiClient();
  });

  it("should not apply prefix without config entry", async () => {
    const url = await client.getUrl();
    expect(url).to.equal("https://api.bentley.com/test-api");
  });

  it("should apply prefix with config entry", async () => {
    process.env.IMJS_URL_PREFIX = "test-";
    const url = await client.getUrl();
    expect(url).to.equal("https://test-api.bentley.com/test-api");
    delete process.env.IMJS_URL_PREFIX;
  });
});
