/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ServiceAuthorizationClient, ServiceAuthorizationClientConfiguration } from "@itwin/service-authorization";
import { AccessToken, Guid, GuidString, Logger } from "@itwin/core-bentley";
import { EventSAS, EventSubscription, IModelHubClient, IModelHubEvent } from "@bentley/imodelhub-client";

if (process.env.IMJS_AGENT_TEST_CLIENT_ID === undefined)
  throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_ID");
if (process.env.IMJS_AGENT_TEST_CLIENT_SECRET === undefined)
  throw new Error("Could not find IMJS_AGENT_TEST_CLIENT_SECRET");
if (process.env.IMJS_OIDC_BROWSER_TEST_SCOPES === undefined)
  throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_SCOPES");

const clientConfig: ServiceAuthorizationClientConfiguration = {
  clientId: process.env.IMJS_AGENT_TEST_CLIENT_ID ?? "",
  clientSecret: process.env.IMJS_AGENT_TEST_CLIENT_SECRET ?? "",
  scope: process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? "",
};

const authorizationClient = new ServiceAuthorizationClient(clientConfig);
const imodelHubClient: IModelHubClient = new IModelHubClient();
const imodelId: GuidString = Guid.createValue();

// __PUBLISH_EXTRACT_START__ EventHandler.createListener.authenticate.example-code
async function authenticate(): Promise<AccessToken> {
  return authorizationClient.getAccessToken();
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ EventHandler.createListener.callback.example-code
function processEvent(event: IModelHubEvent): void {
  Logger.logInfo("example", `Event of the type ${typeof event} received.`);
}
// __PUBLISH_EXTRACT_END__

// enclosing function avoids compile errors and code analysis report.
export async function testit() {
  const accessToken: AccessToken = "";
  // __PUBLISH_EXTRACT_START__ EventSubscriptionsHandler.create.example-code
  const subscription: EventSubscription = await imodelHubClient.events
    .subscriptions.create(accessToken, imodelId, ["ChangeSetPostPushEvent", "VersionEvent"]); // eslint-disable-line deprecation/deprecation
  // __PUBLISH_EXTRACT_END__
  // __PUBLISH_EXTRACT_START__ EventHandler.getSASToken.example-code
  const sasToken: EventSAS = await imodelHubClient.events.getSASToken(accessToken, imodelId);
  // __PUBLISH_EXTRACT_END__
  // __PUBLISH_EXTRACT_START__ EventHandler.getEvent.example-code
  const event: IModelHubEvent | undefined = await imodelHubClient.events
    .getEvent(sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60);
  // __PUBLISH_EXTRACT_END__
  if (!event)
    return;
  // __PUBLISH_EXTRACT_START__ EventHandler.createListener.create.example-code
  const deleteCallback = await imodelHubClient.events  // eslint-disable-line @typescript-eslint/await-thenable
    .createListener(authenticate, subscription.wsgId, imodelId, processEvent);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ EventHandler.createListener.delete.example-code
  deleteCallback();
  // __PUBLISH_EXTRACT_END__
}
