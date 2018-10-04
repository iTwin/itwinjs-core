/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelHubClient, AccessToken, EventSubscription,
  ImsActiveSecureTokenClient, IModelHubEvent, EventSAS, AuthorizationToken,
} from "@bentley/imodeljs-clients";

import { ActivityLoggingContext, Guid, Logger } from "@bentley/bentleyjs-core";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public toTokenString() { return ""; }
}

const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient("PROD");
const imodelHubClient: IModelHubClient = new IModelHubClient();
const imodelId: Guid = new Guid(true);
const username: string = "";
const password: string = "";

// __PUBLISH_EXTRACT_START__ EventHandler.createListener.authenticate.example-code
async function authenticate(): Promise<AccessToken> {
  const alctx: ActivityLoggingContext = new ActivityLoggingContext(Guid.createValue());
  const authorizationToken: AuthorizationToken = await authorizationClient
    .getToken(alctx, username, password);
  return imodelHubClient.getAccessToken(alctx, authorizationToken);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ EventHandler.createListener.callback.example-code
function processEvent(event: IModelHubEvent): void {
  Logger.logInfo("example", `Event of the type ${typeof event} received.`);
}
// __PUBLISH_EXTRACT_END__

async () => {
  const alctx: ActivityLoggingContext = new ActivityLoggingContext("b0f0808d-e76f-4615-acf4-95aa1b78eba5");
  const accessToken = new MockAccessToken();
  // __PUBLISH_EXTRACT_START__ EventSubscriptionsHandler.create.example-code
  const subscription: EventSubscription = await imodelHubClient.Events()
    .Subscriptions().create(alctx, accessToken, imodelId, ["ChangeSetPostPushEvent", "VersionEvent"]);
  // __PUBLISH_EXTRACT_END__
  // __PUBLISH_EXTRACT_START__ EventHandler.getSASToken.example-code
  const sasToken: EventSAS = await imodelHubClient.Events().getSASToken(alctx, accessToken, imodelId);
  // __PUBLISH_EXTRACT_END__
  // __PUBLISH_EXTRACT_START__ EventHandler.getEvent.example-code
  const event: IModelHubEvent | undefined = await imodelHubClient.Events()
    .getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60);
  // __PUBLISH_EXTRACT_END__
  if (!event)
    return;
  // __PUBLISH_EXTRACT_START__ EventHandler.createListener.create.example-code
  const deleteCallback = await imodelHubClient.Events()
    .createListener(alctx, authenticate, subscription.wsgId, imodelId, processEvent);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ EventHandler.createListener.delete.example-code
  deleteCallback();
  // __PUBLISH_EXTRACT_END__
};
