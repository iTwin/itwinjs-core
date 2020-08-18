/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Telemetry
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { IntrospectionClient, IntrospectionResponse } from "../oidc";

/**
 * @alpha
 * Data obtained via token introspection that is relevant within telemetry events
 */
export class ClientAuthDetail {
  /** Client ID obtained by introspecting the client's authorization token */
  public readonly clientAuthClientId?: string;
  /** User ID obtained by introspecting the client's authorization token */
  public readonly clientAuthUserId?: string;

  public constructor(response: IntrospectionResponse) {
    this.clientAuthClientId = response.client_id;
    this.clientAuthUserId = response.sub;
  }

  /**
   * Returns all known properties as a new object
   */
  public getProperties(): { [key: string]: any } {
    const properties: { [key: string]: any } = {
      clientAuthClientId: this.clientAuthClientId,
      clientAuthUserId: this.clientAuthUserId,
    };

    return properties;
  }
}

/**
 * @alpha
 * Retrieves and maps an [[IntrospectionResponse]] to a telemetry-friendly form of type [[ClientAuthDetail]] using the provided [[Introspection]]
 */
export class ClientAuthIntrospectionManager {
  public constructor(public readonly introspectionClient: IntrospectionClient) {
  }

  public async getClientAuthDetails(requestContext: AuthorizedClientRequestContext): Promise<ClientAuthDetail> {
    const introspectionResponse = await this.introspectionClient.introspect(requestContext);
    const clientAuthDetail = new ClientAuthDetail(introspectionResponse);
    return clientAuthDetail;
  }
}
