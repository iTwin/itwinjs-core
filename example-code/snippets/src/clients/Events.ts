/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelHubClient, AccessToken, EventSubscription,
  ImsActiveSecureTokenClient, IModelHubEvent, EventSAS, AuthorizationToken,
  AuthorizedClientRequestContext, ImsUserCredentials,
} from "@bentley/imodeljs-clients";

import { GuidString, Guid, Logger, ClientRequestContext } from "@bentley/bentleyjs-core";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public toTokenString() { return ""; }
}

const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
const imodelHubClient: IModelHubClient = new IModelHubClient();
const imodelId: GuidString = Guid.createValue();
const userCredentials: ImsUserCredentials = {
  email: "",
  password: "",
};

// __PUBLISH_EXTRACT_START__ EventHandler.createListener.authenticate.example-code
async function authenticate(): Promise<AccessToken> {
  const requestContext = new ClientRequestContext();
  const authorizationToken: AuthorizationToken = await authorizationClient
    .getToken(requestContext, userCredentials);
  return imodelHubClient.getAccessToken(requestContext, authorizationToken);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ EventHandler.createListener.callback.example-code
function processEvent(event: IModelHubEvent): void {
  Logger.logInfo("example", `Event of the type ${typeof event} received.`);
}
// __PUBLISH_EXTRACT_END__

async () => {
  const accessToken = new MockAccessToken();
  const requestContext = new ClientRequestContext("b0f0808d-e76f-4615-acf4-95aa1b78eba5");
  const authorizedRequestContext = new AuthorizedClientRequestContext(accessToken, "b0f0808d-e76f-4615-acf4-95aa1b78eba5");
  // __PUBLISH_EXTRACT_START__ EventSubscriptionsHandler.create.example-code
  const subscription: EventSubscription = await imodelHubClient.events
    .subscriptions.create(authorizedRequestContext, imodelId, ["ChangeSetPostPushEvent", "VersionEvent"]);
  // __PUBLISH_EXTRACT_END__
  // __PUBLISH_EXTRACT_START__ EventHandler.getSASToken.example-code
  const sasToken: EventSAS = await imodelHubClient.events.getSASToken(authorizedRequestContext, imodelId);
  // __PUBLISH_EXTRACT_END__
  // __PUBLISH_EXTRACT_START__ EventHandler.getEvent.example-code
  const event: IModelHubEvent | undefined = await imodelHubClient.events
    .getEvent(requestContext, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60);
  // __PUBLISH_EXTRACT_END__
  if (!event)
    return;
  // __PUBLISH_EXTRACT_START__ EventHandler.createListener.create.example-code
  const deleteCallback = await imodelHubClient.events  // tslint:disable-line:await-promise
    .createListener(requestContext, authenticate, subscription.wsgId, imodelId, processEvent);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ EventHandler.createListener.delete.example-code
  deleteCallback();
  // __PUBLISH_EXTRACT_END__
};
