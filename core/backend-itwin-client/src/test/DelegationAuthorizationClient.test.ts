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

    if (process.env.imjs_agent_test_client_id === undefined)
      throw new Error("Could not find imjs_agent_test_client_id");
    if (process.env.imjs_agent_test_client_secret === undefined)
      throw new Error("Could not find imjs_agent_test_client_secret");

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: process.env.imjs_agent_test_client_id ?? "",
      clientSecret: process.env.imjs_agent_test_client_secret ?? "",
      scope: "imodelhub rbac-user:external-client reality-data:read urlps-third-party context-registry-service:read-only imodeljs-backend-2686",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    jwt = await agentClient.getAccessToken(requestContext);
  });

  it("should get valid OIDC delegation tokens", async () => {
    if (process.env.imjs_delegation_test_client_id === undefined)
      throw new Error("Could not find imjs_delegation_test_client_id");
    if (process.env.imjs_delegation_test_client_secret === undefined)
      throw new Error("Could not find imjs_delegation_test_client_secret");

    const delegationConfiguration: DelegationAuthorizationClientConfiguration = {
      clientId:process.env.imjs_delegation_test_client_id ?? "",
      clientSecret: process.env.imjs_delegation_test_client_secret ?? "",
      scope: "context-registry-service imodelhub rbac-service",
    };

    const delegationClient = new DelegationAuthorizationClient(delegationConfiguration);
    const delegationJwt = await delegationClient.getJwtFromJwt(requestContext, jwt);
    await validator.validateContextRegistryAccess(delegationJwt);
    await validator.validateIModelHubAccess(delegationJwt);
  });

});
