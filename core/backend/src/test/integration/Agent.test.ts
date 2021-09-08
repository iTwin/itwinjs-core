import { assert } from "chai";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AgentAuthorizationClient, AgentAuthorizationClientConfiguration } from "@bentley/backend-itwin-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Configuration needed
//    IMJS_AGENT_TEST_CLIENT_ID
//    IMJS_AGENT_TEST_CLIENT_SECRET

describe("Agent iModel Download (#integration)", () => {
  // SWB
  let testProjectId: string;
  let testReadIModelId: string;
  let requestContext: AuthorizedBackendRequestContext;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();

    if (process.env.IMJS_AGENT_TEST_CLIENT_ID === undefined)
      throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_ID");
    if (process.env.IMJS_AGENT_TEST_CLIENT_SECRET === undefined)
      throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_SECRET");

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: process.env.IMJS_AGENT_TEST_CLIENT_ID ?? "",
      clientSecret: process.env.IMJS_AGENT_TEST_CLIENT_SECRET ?? "",
      scope: "imodelhub context-registry-service:read-only",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    const jwt = await agentClient.getAccessToken(new ClientRequestContext());
    requestContext = new AuthorizedBackendRequestContext(jwt);
    requestContext.enter();

    // SWB
    testProjectId = await HubUtility.getTestContextId(requestContext);
    testReadIModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readOnly);
  });

  it("Agent should be able to open a checkpoint", async () => {
    // SWB
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testReadIModelId });
    assert.isDefined(iModelDb);
    iModelDb.close();
  });

});
