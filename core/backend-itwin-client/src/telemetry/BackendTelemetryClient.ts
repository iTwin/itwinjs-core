/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Telemetry
 */

import { getErrorProps, Logger } from "@bentley/bentleyjs-core";
import { ClientTelemetryEvent, TelemetryClient, TelemetryEvent } from "@bentley/telemetry-client";
import { RpcActivity } from "@bentley/imodeljs-common";
import { BackendITwinClientLoggerCategory } from "../BackendITwinClientLoggerCategory";
import { ClientAuthDetail, ClientAuthIntrospectionManager } from "./ClientAuthIntrospectionManager";

/**
 * @alpha
 * A client telemetry event augmented with data obtained via backend configuration and/or token introspection.
 * Such additional information should only be obtainable by privileged/secure backend clients.
 */
export class BackendTelemetryEvent extends ClientTelemetryEvent {
  public constructor(
    telemetryEvent: TelemetryEvent,
    rpcActivity: RpcActivity,
    public backendMachineName?: string,
    /** Application ID from the backend configuration */
    public backendApplicationId?: string,
    /** Application version from the backend configuration */
    public backendApplicationVersion?: string,
    /** Data obtained via introspection of the client's auth token */
    public clientAuth?: ClientAuthDetail,
  ) {
    super(telemetryEvent, rpcActivity);
  }

  /**
   * Returns all known and defined properties as a new object
   */
  public override getProperties(): { [key: string]: any } {
    const properties = super.getProperties();

    properties.backendMachineName = this.backendMachineName;
    properties.backendApplicationId = this.backendApplicationId;
    properties.backendApplicationVersion = this.backendApplicationVersion;
    properties.clientAuth = this.clientAuth?.getProperties();

    return properties;
  }
}

/**
 * Template class for telemetry clients to be used from protected backend clients
 * @alpha
 */
export abstract class BackendTelemetryClient implements TelemetryClient {
  constructor(
    protected readonly _backendMachineName?: string,
    protected readonly _backendApplicationId?: string,
    protected readonly _backendApplicationVersion?: string,
    protected readonly _clientAuthManager?: ClientAuthIntrospectionManager,
  ) {
  }

  public async postTelemetry(requestContext: RpcActivity, telemetryEvent: TelemetryEvent): Promise<void> {
    let clientAuth: ClientAuthDetail | undefined;
    try {
      clientAuth = this._clientAuthManager
        ? await this._clientAuthManager.getClientAuthDetails(requestContext)
        : undefined;
    } catch (err) {
      Logger.logWarning(BackendITwinClientLoggerCategory.Telemetry, `Unable to obtain client auth details from request context`, () => getErrorProps(err));
    }

    const backendTelemetryEvent = new BackendTelemetryEvent(telemetryEvent, requestContext, this._backendMachineName, this._backendApplicationId, this._backendApplicationVersion, clientAuth);
    await this._postTelemetry(requestContext, backendTelemetryEvent);
  }

  protected abstract _postTelemetry(requestContext: RpcActivity, telemetryEvent: BackendTelemetryEvent): Promise<void>;
}
