/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Telemetry
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ClientTelemetryEvent, FrontendTelemetryClient } from "@bentley/telemetry-client";
import { ApplicationInsights } from "@microsoft/applicationinsights-web";

/**
 * @alpha
 */
export class FrontendApplicationInsightsClient extends FrontendTelemetryClient {
  protected readonly _aiClient: ApplicationInsights;

  public constructor(protected readonly _applicationInsightsKey: string) {
    super();
    this._aiClient = new ApplicationInsights({ config: { instrumentationKey: _applicationInsightsKey } });
    this._aiClient.loadAppInsights();
  }

  protected async _postTelemetry(_requestContext: AuthorizedClientRequestContext, frontendTelemetryEvent: ClientTelemetryEvent): Promise<void> {
    const properties = frontendTelemetryEvent.getProperties();

    delete properties.eventName; // No need to duplicate this property when sending
    this._aiClient.trackEvent({
      name: frontendTelemetryEvent.eventName,
      properties,
    });
  }
}
