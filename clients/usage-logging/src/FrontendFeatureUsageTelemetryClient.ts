/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UsageLogging
 */

import { Guid, Logger } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ClientTelemetryEvent, FrontendTelemetryClient } from "@bentley/telemetry-client";
import { FeatureLogEntry, UsageLoggingClient, UsageType } from "./UsageLoggingClient";
import { UsageLoggingClientLoggerCategory } from "./UsageLoggingClientLoggerCategories";

/**
 * @internal
 * Wrapper around [[UsageLoggingClient]] that implements [[TelemetryClient]]
 */
export class FrontendFeatureUsageTelemetryClient extends FrontendTelemetryClient {
  private readonly _usageLoggingClient = new UsageLoggingClient();

  public constructor(protected readonly _hostname: string = "IMJSDEFAULT") {
    super();
  }

  protected async _postTelemetry(requestContext: AuthorizedClientRequestContext, clientTelemetryEvent: ClientTelemetryEvent): Promise<void> {
    const featureLogEntry = FrontendFeatureUsageTelemetryClient.getFeatureLogEntry(clientTelemetryEvent, this._hostname);
    await this._usageLoggingClient.logFeatureUsage(requestContext, featureLogEntry);
  }

  public static getFeatureLogEntry(clientTelemetryEvent: ClientTelemetryEvent, hostname: string): FeatureLogEntry {
    if (!clientTelemetryEvent.eventId || !Guid.isGuid(clientTelemetryEvent.eventId)) { // valid featureId Guid is required to post to ULAS
      const message = `Could not log feature usage with name: ${clientTelemetryEvent.eventName}. Valid featureId Guid is required by ULAS. Supplied featureId: ${clientTelemetryEvent.eventId}`;
      Logger.logError(UsageLoggingClientLoggerCategory.Telemetry, message, () => ({ clientTelemetryEvent }));
      throw new Error(message);
    }

    const featureLogEntry = new FeatureLogEntry(
      clientTelemetryEvent.eventId,
      hostname,
      UsageType.Production,
      clientTelemetryEvent.contextId,
    );
    if (clientTelemetryEvent.time) {
      featureLogEntry.startTime = clientTelemetryEvent.time.startTime;
      featureLogEntry.endTime = clientTelemetryEvent.time.endTime;
    }

    const eventProps = clientTelemetryEvent.getProperties();
    // remove redundant fields
    delete eventProps.eventId;
    delete eventProps.contextId;
    delete eventProps.time;

    const eventStringProps: { [key: string]: string } = {};
    for (const propName in eventProps) { // eslint-disable-line guard-for-in
      eventStringProps[propName] = JSON.stringify(propName);
    }
    featureLogEntry.additionalData = eventStringProps;

    return featureLogEntry;
  }
}
