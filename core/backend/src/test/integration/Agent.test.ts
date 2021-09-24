/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { AgentAuthorizationClient, AgentAuthorizationClientConfiguration } from "@bentley/backend-itwin-client";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";
import { AccessToken } from "@bentley/bentleyjs-core";

// Configuration needed
//    IMJS_AGENT_TEST_CLIENT_ID
//    IMJS_AGENT_TEST_CLIENT_SECRET

describe("Agent iModel Download (#integration)", () => {
  let testProjectId: string;
  let testReadIModelId: string;
  let user: AccessToken;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();

    if (process.env.IMJS_AGENT_TEST_CLIENT_ID === undefined)
      throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_ID");
    if (process.env.IMJS_AGENT_TEST_CLIENT_SECRET === undefined)
      throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_SECRET");

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: process.env.IMJS_AGENT_TEST_CLIENT_ID ?? "",
      clientSecret: process.env.IMJS_AGENT_TEST_CLIENT_SECRET ?? "",
      scope: process.env.IMJS_AGENT_TEST_CLIENT_SCOPES ?? "",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    user = await agentClient.getAccessToken();

    testProjectId = await HubUtility.getTestITwinId(user);
    testReadIModelId = await HubUtility.getTestIModelId(user, HubUtility.testIModelNames.readOnly);
  });

  it("Agent should be able to open a checkpoint", async () => {
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ user, iTwinId: testProjectId, iModelId: testReadIModelId });
    assert.isDefined(iModelDb);
    iModelDb.close();
  });

});
