/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Telemetry
 */

import { BentleyError, GuidString, Logger } from "@itwin/core-bentley";
import { RpcActivity } from "@itwin/core-common";
import { TelemetryClientLoggerCategory } from "./TelemetryClientLoggerCategory";

/**
 * @alpha
 * Represents a particular occurrence of an event that can be tracked through various telemetry services
 */
export class TelemetryEvent {
  public constructor(
    /** Human-readable name for the event being tracked */
    public readonly eventName: string,
    /**
     * Optional Guid that can be used to more accurately identify the telemetry event.
     * This field is required when posting a telemetry event as feature usage to ULAS.
     */
    public readonly eventId?: GuidString,
    /** iModel parent iTwin id */
    public readonly iTwinId?: GuidString,
    public readonly iModelId?: GuidString,
    public readonly changeSetId?: GuidString,
    public readonly time?: {
      startTime: Date;
      endTime: Date;
    },
    /** Custom properties  */
    public readonly additionalProperties: { [key: string]: any } = {},
  ) {
  }

  /**
   * Returns all properties as a new object
   */
  public getProperties(): { [key: string]: any } {
    const properties: { [key: string]: any } = {
      eventName: this.eventName,
      eventId: this.eventId,
      iTwinId: this.iTwinId,
      iModelId: this.iModelId,
      changeSetId: this.changeSetId,
      time: this.time,
      additionalProperties: this.additionalProperties,
    };

    return properties;
  }
}

/** @alpha */
export interface TelemetryClient {
  postTelemetry(requestContext: RpcActivity, telemetryEvent: TelemetryEvent): Promise<void>;
}

/** @alpha */
export class TelemetryManager {
  protected readonly _clients: Set<TelemetryClient>;

  constructor(...clients: TelemetryClient[]) {
    this._clients = new Set<TelemetryClient>(clients);
  }

  public async postTelemetry(requestContext: RpcActivity, telemetryEvent: TelemetryEvent): Promise<void> {
    const postPerClient = async (subClient: TelemetryClient) => {
      try {
        await subClient.postTelemetry(requestContext, telemetryEvent);
      } catch (err) {
        Logger.logError(TelemetryClientLoggerCategory.Telemetry, `Failed to post telemetry via subclient`, () => BentleyError.getErrorProps(err));
      }
    };

    const subClientPromises = [];
    for (const subClient of this._clients) {
      subClientPromises.push(postPerClient(subClient));
    }

    await Promise.all(subClientPromises);
  }

  public addClient(client: TelemetryClient): void {
    this._clients.add(client);
  }

  public hasClient(client: TelemetryClient): boolean {
    return this._clients.has(client);
  }
}
