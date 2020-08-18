/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Telemetry
 */

import { BackendTelemetryClient, BackendTelemetryEvent, ClientAuthIntrospectionManager } from "@bentley/backend-itwin-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TelemetryClient as AITelemetryClient } from "applicationinsights";
import { Envelope } from "applicationinsights/out/Declarations/Contracts";

/** @alpha */
export class BackendApplicationInsightsClient extends BackendTelemetryClient {
  protected readonly _aiClient: AITelemetryClient;

  public constructor(config: {
    applicationInsightsKey: string;
    backendMachineName?: string;
    backendApplicationId?: string;
    backendApplicationVersion?: string;
    clientAuthManager?: ClientAuthIntrospectionManager;
  }) {
    super(config.backendMachineName, config.backendApplicationId, config.backendApplicationVersion, config.clientAuthManager);
    this._aiClient = new AITelemetryClient(config.applicationInsightsKey);
    this._aiClient.addTelemetryProcessor((envelope, contextObjects) => this._addContextData(envelope, contextObjects));
  }

  protected async _postTelemetry(_requestContext: AuthorizedClientRequestContext, backendTelemetryEvent: BackendTelemetryEvent): Promise<void> {
    const contextObjects = this.getContextData(backendTelemetryEvent);
    const properties = backendTelemetryEvent.getProperties();

    delete properties.eventName; // No need to duplicate this property when sending
    this._aiClient.trackEvent({
      name: backendTelemetryEvent.eventName,
      properties,
      contextObjects,
    });
  }

  protected getContextData(backendTelemetryEvent: BackendTelemetryEvent): { [key: string]: any } {
    const contextObjects: { [name: string]: string } = {};
    if (backendTelemetryEvent.sessionId) { contextObjects[this._aiClient.context.keys.sessionId] = backendTelemetryEvent.sessionId; }
    if (backendTelemetryEvent.clientUserId) { contextObjects[this._aiClient.context.keys.userId] = backendTelemetryEvent.clientUserId; }
    if (backendTelemetryEvent.clientAuth?.clientAuthUserId) { contextObjects[this._aiClient.context.keys.userAuthUserId] = backendTelemetryEvent.clientAuth.clientAuthUserId; }
    return contextObjects;
  }

  private _addContextData(envelope: Envelope, contextObjects?: { [key: string]: any }): boolean {
    for (const key in contextObjects) { // eslint-disable-line guard-for-in
      envelope.tags[key] = contextObjects[key];
    }

    return true;
  }
}
