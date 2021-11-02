/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Telemetry
 */

import { GuidString } from "@itwin/core-bentley";
import { RpcActivity } from "@itwin/core-common";
import { TelemetryClient, TelemetryEvent } from "./TelemetryClient";

/**
 * @alpha
 * General telemetry event data augmented with data obtained from an [[AuthorizedClientRequestContext]]
 */
export class ClientTelemetryEvent extends TelemetryEvent {
  protected static readonly _iModelJsVersion: string = require("../../package.json").version; // eslint-disable-line @typescript-eslint/no-var-requires
  public get iModelJsVersion(): string { return ClientTelemetryEvent._iModelJsVersion; }
  /** Unique identifier for the current activity. Useful for correlating any actions performed during a specific activity. */
  public readonly activityId?: GuidString;
  /** Unique identifier for the current user session. */
  public readonly sessionId?: GuidString;
  /** Application ID configured for the client application. */
  public readonly clientApplicationId?: string;
  /** Application version configured for the client application. */
  public readonly clientApplicationVersion?: string;

  public constructor(telemetryEvent: TelemetryEvent, requestContext: RpcActivity) {
    super(telemetryEvent.eventName, telemetryEvent.eventId, telemetryEvent.iTwinId, telemetryEvent.iModelId, telemetryEvent.changeSetId, telemetryEvent.time, telemetryEvent.additionalProperties);

    this.activityId = requestContext.activityId;
    this.sessionId = requestContext.sessionId;
    this.clientApplicationId = requestContext.applicationId;
    this.clientApplicationVersion = requestContext.applicationVersion;
  }

  public override getProperties(): { [key: string]: any } {
    const properties = super.getProperties();

    properties.activityId = this.activityId;
    properties.sessionId = this.sessionId;
    properties.clientApplicationId = this.clientApplicationId;
    properties.clientApplicationVersion = this.clientApplicationVersion;

    return properties;
  }
}

/**
 * @alpha
 * General template class for telemetry clients to be used by frontend clients
 */
export abstract class FrontendTelemetryClient implements TelemetryClient {
  protected constructor() {
  }

  public async postTelemetry(requestContext: RpcActivity, telemetryEvent: TelemetryEvent): Promise<void> {
    const frontendTelemetryEvent = new ClientTelemetryEvent(telemetryEvent, requestContext);
    await this._postTelemetry(requestContext, frontendTelemetryEvent);
  }

  protected abstract _postTelemetry(requestContext: RpcActivity, telemetryEvent: ClientTelemetryEvent): Promise<void>;
}
