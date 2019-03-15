/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelHubClient, AccessToken, GlobalEventSubscription, AuthorizationToken,
  ImsActiveSecureTokenClient, IModelHubGlobalEvent, GlobalEventSAS, GetEventOperationType,
  AuthorizedClientRequestContext, ImsUserCredentials,
} from "@bentley/imodeljs-clients";
import { Logger, ClientRequestContext } from "@bentley/bentleyjs-core";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public toTokenString() { return ""; }
}

const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
const imodelHubClient: IModelHubClient = new IModelHubClient();
const userCredentials: ImsUserCredentials = {
  email: "",
  password: "",
};

// __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.authenticate.example-code
async function authenticate(): Promise<AccessToken> {
  const requestContext = new ClientRequestContext();
  const authorizationToken: AuthorizationToken = await authorizationClient
    .getToken(requestContext, userCredentials);
  return imodelHubClient.getAccessToken(requestContext, authorizationToken);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.callback.example-code
function processGlobalEvent(event: IModelHubGlobalEvent): void {
  Logger.logInfo("example", `Global Event of the type ${typeof event} received.`);
}
// __PUBLISH_EXTRACT_END__

async () => {
  const accessToken = new MockAccessToken();
  const requestContext = new ClientRequestContext("b0f0808d-e76f-4615-acf4-95aa1b78eba5");
  const authorizedRequestContext = new AuthorizedClientRequestContext(accessToken, "b0f0808d-e76f-4615-acf4-95aa1b78eba5");

  // __PUBLISH_EXTRACT_START__ GlobalEventSubscriptionsHandler.create.example-code
  const id = "c41580e2-6ac9-473c-9194-2c9a36187dbd";
  const subscription: GlobalEventSubscription = await imodelHubClient.globalEvents
    .subscriptions.create(authorizedRequestContext, id, ["iModelCreatedEvent", "NamedVersionCreatedEvent"]);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getSASToken.example-code
  const sasToken: GlobalEventSAS = await imodelHubClient.globalEvents.getSASToken(authorizedRequestContext);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getEvent.example-code
  const globalEvent: IModelHubGlobalEvent | undefined = await imodelHubClient.globalEvents
    .getEvent(requestContext, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60);
  // __PUBLISH_EXTRACT_END__

  if (globalEvent)
    return;

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getEvent.lock.example-code
  const globalEventWithLock: IModelHubGlobalEvent | undefined = await imodelHubClient.globalEvents
    .getEvent(requestContext, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60, GetEventOperationType.Peek);
  // __PUBLISH_EXTRACT_END__

  if (!globalEventWithLock)
    return;

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getEvent.delete.example-code
  await globalEventWithLock.delete(authorizedRequestContext);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.create.example-code
  const deleteCallback = await imodelHubClient.globalEvents // tslint:disable-line:await-promise
    .createListener(authorizedRequestContext, authenticate, subscription.wsgId, processGlobalEvent);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.delete.example-code
  // Delete callback when events should be no longer received
  deleteCallback();
  // __PUBLISH_EXTRACT_END__
};
