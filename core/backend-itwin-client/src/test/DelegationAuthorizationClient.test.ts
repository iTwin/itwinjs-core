/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as path from "path";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/itwin-client";
import { AgentAuthorizationClient, AgentAuthorizationClientConfiguration } from "../oidc/AgentAuthorizationClient";
import { DelegationAuthorizationClient, DelegationAuthorizationClientConfiguration } from "../oidc/DelegationAuthorizationClient";
import { HubAccessTestValidator } from "./HubAccessTestValidator";
import * as fs from "fs";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

loadEnv(path.join(__dirname, "..", "..", ".env"));

chai.should();

describe("DelegationAuthorizationClient (#integration)", () => {

  let validator: HubAccessTestValidator;
  let jwt: AccessToken;
  const requestContext = new ClientRequestContext();

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    if (process.env.IMJS_AGENT_TEST_CLIENT_ID === undefined)
      throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_ID");
    if (process.env.IMJS_AGENT_TEST_CLIENT_SECRET === undefined)
      throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_SECRET");

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: process.env.IMJS_AGENT_TEST_CLIENT_ID ?? "",
      clientSecret: process.env.IMJS_AGENT_TEST_CLIENT_SECRET ?? "",
      scope: "imodelhub rbac-user:external-client reality-data:read urlps-third-party context-registry-service:read-only imodeljs-backend-2686",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    jwt = await agentClient.getAccessToken(requestContext);
  });

  it("should get valid OIDC delegation tokens", async () => {
    if (process.env.IMJS_DELEGATION_TEST_CLIENT_ID === undefined)
      throw new Error("Could not find IMJS_DELEGATION_TEST_CLIENT_ID");
    if (process.env.IMJS_DELEGATION_TEST_CLIENT_SECRET === undefined)
      throw new Error("Could not find IMJS_DELEGATION_TEST_CLIENT_SECRET");

    const delegationConfiguration: DelegationAuthorizationClientConfiguration = {
      clientId:process.env.IMJS_DELEGATION_TEST_CLIENT_ID ?? "",
      clientSecret: process.env.IMJS_DELEGATION_TEST_CLIENT_SECRET ?? "",
      scope: "context-registry-service imodelhub rbac-service",
    };

    const delegationClient = new DelegationAuthorizationClient(delegationConfiguration);
    const delegationJwt = await delegationClient.getJwtFromJwt(requestContext, jwt);
    await validator.validateITwinClientAccess(delegationJwt);
    await validator.validateIModelHubAccess(delegationJwt);
  });

});
