/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelHubClient, AccessToken, GlobalEventSubscription, AuthorizationToken,
  ImsActiveSecureTokenClient, IModelHubGlobalEvent, GlobalEventSAS, GetEventOperationType,
} from "@bentley/imodeljs-clients";

import { Guid, ActivityLoggingContext, Logger } from "@bentley/bentleyjs-core";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public toTokenString() { return ""; }
}

const authorizationClient: ImsActiveSecureTokenClient = new ImsActiveSecureTokenClient();
const imodelHubClient: IModelHubClient = new IModelHubClient();
const username: string = "";
const password: string = "";
const token: AccessToken = new MockAccessToken();

// __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.authenticate.example-code
async function authenticate(): Promise<AccessToken> {
  const alctx: ActivityLoggingContext = new ActivityLoggingContext(Guid.createValue());
  const authorizationToken: AuthorizationToken = await authorizationClient
    .getToken(alctx, username, password);
  return imodelHubClient.getAccessToken(alctx, authorizationToken);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.callback.example-code
function processGlobalEvent(event: IModelHubGlobalEvent): void {
  Logger.logInfo("example", `Global Event of the type ${typeof event} received.`);
}
// __PUBLISH_EXTRACT_END__

async () => {
  const alctx: ActivityLoggingContext = new ActivityLoggingContext("b0f0808d-e76f-4615-acf4-95aa1b78eba5");
  const accessToken = new MockAccessToken();
  // __PUBLISH_EXTRACT_START__ GlobalEventSubscriptionsHandler.create.example-code
  const id = "c41580e2-6ac9-473c-9194-2c9a36187dbd";
  const subscription: GlobalEventSubscription = await imodelHubClient.GlobalEvents()
    .Subscriptions().create(alctx, token, id, ["iModelCreatedEvent", "NamedVersionCreatedEvent"]);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getSASToken.example-code
  const sasToken: GlobalEventSAS = await imodelHubClient.GlobalEvents().getSASToken(alctx, accessToken);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getEvent.example-code
  const globalEvent: IModelHubGlobalEvent | undefined = await imodelHubClient.GlobalEvents()
    .getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60);
  // __PUBLISH_EXTRACT_END__

  if (globalEvent)
    return;

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getEvent.lock.example-code
  const globalEventWithLock: IModelHubGlobalEvent | undefined = await imodelHubClient.GlobalEvents()
    .getEvent(alctx, sasToken.sasToken!, sasToken.baseAddress!, subscription.wsgId, 60, GetEventOperationType.Peek);
  // __PUBLISH_EXTRACT_END__

  if (!globalEventWithLock)
    return;

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.getEvent.delete.example-code
  await globalEventWithLock.delete(alctx);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.create.example-code
  const deleteCallback = await imodelHubClient.GlobalEvents()
    .createListener(alctx, authenticate, subscription.wsgId, processGlobalEvent);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ GlobalEventHandler.createListener.delete.example-code
  // Delete callback when events should be no longer received
  deleteCallback();
  // __PUBLISH_EXTRACT_END__
};
